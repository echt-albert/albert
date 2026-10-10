import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Content-Type":"application/json"};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const str=(v:unknown,max=300)=>String(v??"").trim().slice(0,max);
function decimal(v:unknown){const s=str(v,50).replace(/\s/g,"");if(!s)return null;const normalized=s.includes(",")?s.replace(/\./g,"").replace(",","."):s;const n=Number(normalized);return Number.isFinite(n)&&n>=0&&n<1e8?n:null;}
function quantity(v:unknown){const s=str(v,50);if(!s)return null;const n=Number(s.replace(",","."));return Number.isInteger(n)&&n>=0&&n<1e8?n:null;}
function validEan(s:string){return !s||/^\d{8}$|^\d{12,14}$/.test(s);}
async function sha(text:string){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return respond({});
 if(req.method!=="POST")return respond({success:false,error:"POST erforderlich"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const allowed=(Deno.env.get("SCANNER_ALLOWED_EMAILS")||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!url||!anon||!secret||!allowed.length)return respond({success:false,error:"Scanner-Import ist noch nicht für berechtigte Einkäufer konfiguriert."},503);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return respond({success:false,error:"Anmeldung erforderlich"},401);
 const auth=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user||!user.email||!allowed.includes(user.email.toLowerCase()))return respond({success:false,error:"Keine Importberechtigung"},403);
 const body=await req.json().catch(()=>null);
 if(!body||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>1000)return respond({success:false,error:"1 bis 1.000 Positionen erforderlich"},400);
 const filename=str(body.filename,160),supplier=str(body.supplier_name,160);
 if(!filename)return respond({success:false,error:"Dateiname fehlt"},400);
 const db=createClient(url,secret);
 let created=0,skipped=0;const errors=[];
 for(let i=0;i<body.rows.length;i++){
  const row=body.rows[i]||{},product=str(row.product_name),ean=str(row.ean_gtin,14),brand=str(row.brand,160),mpn=str(row.mpn,120);
  const qty=quantity(row.quantity),price=decimal(row.purchase_price),line=Number(row.line);
  if(!product||!validEan(ean)||(!Number.isInteger(line)||line<2)|| (str(row.quantity)&&qty===null)||(str(row.purchase_price)&&price===null)){
   errors.push({line:row.line,error:"Unvollständige oder ungültige Produktdaten"});continue;
  }
  // Dedup within the same uploaded source and position; identical later uploads reuse the deal.
  const sourceKey=await sha([filename,line,product,ean,mpn,qty,price].join("|"));
  const {data,error}=await db.rpc("scanner_insert_deal",{p_source_key:sourceKey,p_filename:filename,p_line:line,p_user:user.id,p_product:product,p_brand:brand,p_ean:ean,p_mpn:mpn,p_quantity:qty,p_price:price,p_supplier:supplier});
  if(error){errors.push({line,error:"Speichern fehlgeschlagen"});continue;}
  if(data?.[0]?.created)created++;else skipped++;
 }
 return respond({success:errors.length===0,created,skipped,errors:errors.slice(0,20),error:errors.length?errors.length+" Positionen konnten nicht übernommen werden":undefined},errors.length?207:200);
});
