import { GoogleGenAI } from "npm:@google/genai";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Content-Type":"application/json"};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:cors});
const clean=(v:unknown)=>String(v??"").trim().slice(0,180);
const dbUrl=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cacheHeaders=()=>({apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"});
const cacheKey=(p:any)=>[p.ean_gtin||"",p.brand||"",p.mpn||"",p.product_name||""].map((v:any)=>String(v).trim().toLowerCase()).join("|");
async function readCache(k:string){if(!dbUrl||!serviceKey)return null;try{const r=await fetch(dbUrl+"/rest/v1/market_price_cache?product_key=eq."+encodeURIComponent(k)+"&select=quick_result,deep_result,updated_at",{headers:cacheHeaders()});const a=await r.json();return r.ok&&Array.isArray(a)?a[0]||null:null;}catch{return null}}
async function writeQuick(k:string,result:any){if(!dbUrl||!serviceKey)return;try{const r=await fetch(dbUrl+"/rest/v1/market_price_cache?on_conflict=product_key",{method:"POST",headers:{...cacheHeaders(),Prefer:"resolution=merge-duplicates"},body:JSON.stringify({product_key:k,quick_result:{...result,checked_at:new Date().toISOString()},updated_at:new Date().toISOString()})}); if(!r.ok)console.error("market cache write",r.status,(await r.text()).slice(0,350));}catch(e){console.error("market cache write exception",String(e).slice(0,250))}}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"POST only"},405);
 const key=Deno.env.get("GEMINI_API_KEY");
 const body=await req.json().catch(()=>({}));
 const product=body.product||{};
 const name=clean(product.product_name),brand=clean(product.brand),mpn=clean(product.mpn),ean=clean(product.ean_gtin);
 if(!name&&!ean&&!mpn)return reply({error:"Produktname fehlt"},400);
 const ck=cacheKey(product);
 const cached=await readCache(ck);
 const previous=cached?.quick_result;
 if(previous?.checked_at&&Date.now()-Date.parse(previous.checked_at)<86400000&&previous.success&&(previous.low_eur||previous.cheapest_price_eur))return reply({...previous,cache_hit:true});
 const deep=cached?.deep_result;
 if(deep?.checked_at&&Date.now()-Date.parse(deep.checked_at)<86400000&&deep.report?.market_indication){
   const offers=deep.report.shopping_results||[];
   const cheapest=offers.filter((x:any)=>typeof x.indicative_article_price==="number").sort((a:any,b:any)=>a.indicative_article_price-b.indicative_article_price)[0];
   const m=deep.report.market_indication;
   return reply({success:true,low_eur:m.lowest_article_price,high_eur:m.highest_article_price,cheapest_price_eur:cheapest?.indicative_article_price||null,cheapest_merchant:cheapest?.merchant||null,cheapest_url:cheapest?.url||null,verified:false,cache_hit:true,source:"deep"});
 }
 const serper=Deno.env.get("SERPER_API_KEY");
 if(serper){
 const queries=[[brand,mpn].filter(Boolean).join(" "),[brand,name].filter(Boolean).join(" "),ean].filter(Boolean).slice(0,3);
 const results=await Promise.allSettled(queries.map(async q=>{const r=await fetch("https://google.serper.dev/shopping",{method:"POST",headers:{"X-API-KEY":serper,"Content-Type":"application/json"},body:JSON.stringify({q,gl:"de",hl:"de",num:20}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error("Shopping HTTP "+r.status);return r.json()}));
 const matches:any[]=[];
 for(const x of results)if(x.status==="fulfilled")for(const hit of (x.value.shopping||[])){
 const title=clean(hit.title).toLowerCase();
 const words=name.toLowerCase().split(" ").filter((w:string)=>w.length>3&&!["inkl","inkl.","typ","mit","und","stück","bohrwerkzeugen","robuste"].includes(w));
 const hits=words.filter((w:string)=>title.includes(w)).length;
 const match=Boolean((ean&&title.includes(ean.toLowerCase()))||(mpn&&title.includes(mpn.toLowerCase()))||(words.length>0&&hits>=1&&(!brand||title.includes(brand.toLowerCase()))));
 if(!match)continue;
 const raw=String(hit.price||"").replace(/[^0-9,.]/g,"");const comma=raw.lastIndexOf(","),dot=raw.lastIndexOf(".");const normalized=comma>dot?raw.replaceAll(".","").replace(",","."):dot>comma?raw.replaceAll(",",""):raw.replace(",",".");const price=Number(normalized);
 let link=null;try{const u=new URL(hit.link||hit.productLink);if(u.protocol==="https:")link=u.href}catch{}
 if(link&&price>0&&price<100000)matches.push({price,link,merchant:clean(hit.source||hit.merchant||new URL(link).hostname)});
 }
 console.log("QUICK_SERPER_V7",JSON.stringify({name,brand,mpn,ean,queries,results:results.map((r:any)=>r.status==="fulfilled"?{count:r.value.shopping?.length||0,first:r.value.shopping?.[0]?.title||null}:{error:String(r.reason)}),matches:matches.length}));
 if(matches.length){matches.sort((a,b)=>a.price-b.price);const result={success:true,low_eur:matches[0].price,high_eur:matches[matches.length-1].price,cheapest_price_eur:matches[0].price,cheapest_merchant:matches[0].merchant,cheapest_url:matches[0].link,verified:false,source:"Serper Shopping",match_count:matches.length};await writeQuick(ck,result);return reply(result);}
 }
 if(!key)return reply({success:true,low_eur:null,high_eur:null,verified:false,reason:"Keine Shopping-Treffer; Gemini nicht konfiguriert"});
 try{
 const ai=new GoogleGenAI({apiKey:key});
 const response=await ai.models.generateContent({model:"gemini-3.8-flash",contents:"Schneller, unverbindlicher deutscher B2C-Preischeck (kein Einkaufsurteil) für genau dieses Produkt: "+JSON.stringify({name,brand,mpn,ean})+". Nutze Google Search. Nenne nur Preise, die du in aktuellen Suchtreffern tatsächlich findest. Suche nach EAN/MPN und passender Variante. Auktions-, Gebraucht-, B2B- und UVP-Preise nicht verwenden. Antworte NUR mit JSON {\"low_eur\":null,\"high_eur\":null,\"cheapest_merchant\":null,\"cheapest_price_eur\":null,\"cheapest_url\":null,\"confidence\":\"low\"}. Wenn keine belastbaren aktuellen Preisangaben auffindbar sind, alle Preise null. Keine erfundenen Händler oder Links.",config:{tools:[{googleSearch:{}}]}});
 const raw=(response.text||"").replace(/\`\`\`(?:json)?/gi,"").trim();
 const obj=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]||"{}");
 const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<100000?v:null;
 const url=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:null}catch{return null}};
 const result={success:true,low_eur:num(obj.low_eur),high_eur:num(obj.high_eur),cheapest_price_eur:num(obj.cheapest_price_eur),cheapest_merchant:clean(obj.cheapest_merchant)||null,cheapest_url:url(obj.cheapest_url),verified:false};
 if(result.low_eur||result.cheapest_price_eur)await writeQuick(ck,result);
 return reply(result);
 }catch(e){return reply({success:false,error:"Preisindikation derzeit nicht verfügbar"},502)}
});