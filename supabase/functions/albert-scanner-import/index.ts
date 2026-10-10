import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version","Content-Type":"application/json"};
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
 if(!url||!anon||!secret)return respond({success:false,error:"Scanner-Import: Supabase-Konfiguration unvollständig."},503);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return respond({success:false,error:"Anmeldung erforderlich"},401);
 const auth=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return respond({success:false,error:"Anmeldung erforderlich"},401);
 const db=createClient(url,secret);
 const {data:permission,error:permissionError}=await db.from("scanner_import_authorized_accounts").select("user_id").eq("user_id",user.id).maybeSingle();
 if(permissionError)return respond({success:false,error:"Importberechtigung konnte nicht geprüft werden."},503);
 if(!permission)return respond({success:false,error:"Keine Importberechtigung"},403);
 const body=await req.json().catch(()=>null);
 if(!body||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>1000)return respond({success:false,error:"1 bis 1.000 Positionen erforderlich"},400);
 const filename=str(body.filename,160),supplier=str(body.supplier_name,160);
 if(!filename)return respond({success:false,error:"Dateiname fehlt"},400);
 let created=0,skipped=0;const errors=[];
 for(let i=0;i<body.rows.length;i++){
  const row=body.rows[i]||{},product=str(row.product_name),ean=str(row.ean_gtin,14),brand=str(row.brand,160),mpn=str(row.mpn,120);
  const qty=quantity(row.quantity),price=decimal(row.purchase_price),line=Number(row.line);
  const testValues=row.test_values&&typeof row.test_values==="object"&&!Array.isArray(row.test_values)?row.test_values:null;
  if(!product||!validEan(ean)||(!Number.isInteger(line)||line<2)|| (str(row.quantity)&&qty===null)||(str(row.purchase_price)&&price===null)){
   errors.push({line:row.line,error:"Unvollständige oder ungültige Produktdaten"});continue;
  }
  // Dedup within the same uploaded source and position; identical later uploads reuse the deal.
  const sourceKey=await sha([filename,line,product,ean,mpn,qty,price].join("|"));
  const {data,error}=await db.rpc("scanner_insert_deal",{p_source_key:sourceKey,p_filename:filename,p_line:line,p_user:user.id,p_product:product,p_brand:brand,p_ean:ean,p_mpn:mpn,p_quantity:qty,p_price:price,p_supplier:supplier});
  if(error){errors.push({line,error:"Speichern fehlgeschlagen"});continue;}
  if(data?.[0]?.created)created++;else skipped++;
  // Testdaten separat halten: niemals als verifizierte Marktpreise speichern.
  if(testValues&&Object.values(testValues).some(v=>String(v??"").trim())){
   const dealId=data?.[0]?.deal_id??data?.[0]?.id??null;
   if(!dealId){errors.push({line,error:"Deal gespeichert, aber ID für Testdaten fehlt (RPC-Rückgabe prüfen)"});continue;}
   const safe=Object.fromEntries(Object.entries(testValues).slice(0,30).map(([k,v])=>[str(k,80),str(v,300)]));
   const {error:extraError}=await db.from("scanner_test_values").upsert({discovery_id:dealId,values_json:safe},{onConflict:"discovery_id"});
   if(extraError)errors.push({line,error:"Testdaten konnten nicht gespeichert werden"});
  }
 }
 return respond({success:errors.length===0,created,skipped,errors:errors.slice(0,20),error:errors.length?errors.length+" Positionen konnten nicht übernommen werden":undefined},errors.length?207:200);
});
