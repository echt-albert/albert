// Market evidence collection. Search results are leads, not verified sales or final prices.
function safeUrl(s) { try { const u=new URL(s); return ['https:','http:'].includes(u.protocol)?u.href:null; } catch { return null; } }
function str(x) { return String(x??'').trim().slice(0,300); }
async function lookup(path,q,key) {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const r=await fetch('https://google.serper.dev/'+path,{method:'POST',signal:controller.signal,
      headers:{'X-API-KEY':key,'Content-Type':'application/json'},
      body:JSON.stringify({q,gl:'de',hl:'de',num:20})});
    if(!r.ok) throw Error('Serper HTTP '+r.status);
    return await r.json();
  } finally {clearTimeout(timer);}
}
module.exports=async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Nur POST erlaubt.'});
  const key=process.env.SERPER_API_KEY||process.env.SERPER_KEY;
  if(!key) return res.status(503).json({error:'Serper API-Key ist nicht konfiguriert.'});
  const p=req.body?.product;
  if(!p||typeof p!=='object') return res.status(400).json({error:'Produkt fehlt.'});
  const ean=str(p.ean||p.gtin||p.EAN), mpn=str(p.mpn||p.model_number);
  const name=str(p.product_name||p.name), brand=str(p.brand||p.manufacturer);
  const validEan=/^(?:[0-9]{8}|[0-9]{12,14})$/.test(ean);
  if(!validEan&&!mpn&&!name) return res.status(400).json({error:'EAN, MPN oder Produktname fehlt.'});
  const q=validEan?ean:[brand,mpn||name].filter(Boolean).join(' ');
  try {
    const [shopping,search]=await Promise.all([lookup('shopping',q,key),lookup('search',q+' kaufen Deutschland',key)]);
    const results=(shopping.shopping||[]).slice(0,25).map(x=>{
      const title=str(x.title), url=safeUrl(x.link||x.product_link);
      const eanInTitle=validEan&&title.includes(ean);
      const mpnInTitle=mpn.length>=4&&title.toLowerCase().includes(mpn.toLowerCase());
      return {title,url,merchant:str(x.source),display_price:str(x.price),display_shipping:str(x.delivery||x.shipping),
        identity_match:eanInTitle?'EAN_IN_TITLE':mpnInTitle?'MPN_IN_TITLE':'UNVERIFIED',
        total_price_verified:false};
    }).filter(x=>x.url);
    const web=(search.organic||[]).slice(0,12).map(x=>({title:str(x.title),url:safeUrl(x.link),snippet:str(x.snippet)})).filter(x=>x.url);
    const strong=results.filter(x=>x.identity_match!=='UNVERIFIED');
    return res.status(200).json({success:true,report:{
      checked_at:new Date().toISOString(),source:'Serper Google Shopping und Google Search',
      query:q,identity:{ean:validEan?ean:null,mpn:mpn||null,brand:brand||null,name:name||null},
      identity_status:strong.length?'INDICATION':'UNVERIFIED',
      shopping_results:results,web_results:web,
      verified_lowest_total_price:null,conservative_vk:null,verified_demand:null,actual_sales:null,
      assessment:'VERIFICATION_REQUIRED',
      warnings:['Suchtreffer sind keine unabhängig bestätigten Händlerpreise.',
        'Versandkosten und Produktidentität müssen auf den Händlerseiten geprüft werden.',
        'Keine realen Verkäufe nachgewiesen.']
    }});
  } catch(e) {return res.status(502).json({error:'Marktrecherche fehlgeschlagen: '+e.message});}
};
