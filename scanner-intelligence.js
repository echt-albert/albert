/* Albert Scanner: PDF text extraction and explicit learning feedback.
 * No external upload: PDF parsing happens in the browser. No AI guesses.
 */
(function(){
  'use strict';
  const HISTORY_KEY='albert-scanner-feedback-v1';
  function el(tag, text, cls){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(cls)node.className=cls;
    return node;
  }
  function feedback(){
    try { const value=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); return Array.isArray(value)?value:[]; }
    catch { return []; }
  }
  function recordFeedback(entry){
    const records=feedback();
    records.push({ ...entry, at:new Date().toISOString() });
    localStorage.setItem(HISTORY_KEY,JSON.stringify(records.slice(-500)));
  }
  function downloadFeedback(){
    const blob=new Blob([JSON.stringify(feedback(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='albert-scanner-lerndaten.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function feedbackPanel(container,source,lines){
    const section=el('section',undefined,'mt-4 rounded-xl border border-slate-200 bg-white p-4');
    section.append(el('h4','Erkennung verbessern','font-semibold text-sm'));
    section.append(el('p','Albert speichert Korrekturen derzeit nur lokal in diesem Browser. Kein automatisches Modelltraining.','mt-2 text-xs text-slate-500'));
    const field=el('textarea',undefined,'mt-3 w-full rounded-lg border p-3 text-xs');
    field.rows=3;field.placeholder='Was hat Albert falsch oder richtig erkannt? Produktname, EAN, Menge, Preisbasis …';
    section.append(field);
    const status=el('p','','mt-2 text-xs text-slate-500');
    const save=el('button','Korrektur merken','mt-3 mr-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white');
    save.type='button';save.addEventListener('click',()=>{
      const note=field.value.trim();
      if(!note){status.textContent='Bitte zuerst eine Korrektur eingeben.';return;}
      recordFeedback({source,extracted_sample:lines.slice(0,12),correction:note});
      field.value='';status.textContent='Korrektur lokal gespeichert ('+feedback().length+' Einträge).';
    });
    const exportBtn=el('button','Lerndaten exportieren','mt-3 rounded-lg border px-3 py-2 text-xs');
    exportBtn.type='button';exportBtn.addEventListener('click',downloadFeedback);
    section.append(save,exportBtn,status);container.append(section);
  }
  async function readPdf(file){
    if(file.size>10*1024*1024)throw Error('PDF überschreitet 10 MB.');
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const bytes=new Uint8Array(await file.arrayBuffer());
    const doc=await pdfjs.getDocument({data:bytes}).promise;
    const pages=[];const limit=Math.min(doc.numPages,60);
    try{
      for(let p=1;p<=limit;p++){
        const page=await doc.getPage(p);const content=await page.getTextContent();
        const rows=new Map();
        for(const item of content.items){
          if(!item.str||!item.str.trim())continue;
          const y=Math.round((item.transform?.[5]||0)/3)*3;
          if(!rows.has(y))rows.set(y,[]);
          rows.get(y).push({x:item.transform?.[4]||0,value:item.str});
        }
        const lines=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,parts])=>parts.sort((a,b)=>a.x-b.x).map(x=>x.value).join(' ').trim()).filter(Boolean);
        pages.push({page:p,lines});
      }
    }finally{await doc.destroy();}
    return {pages,total:doc.numPages,truncated:doc.numPages>limit};
  }
  async function showPdf(file,container){
    container.replaceChildren();
    container.append(el('h3','PDF wird lokal gelesen: '+file.name,'font-semibold text-slate-900'));
    try{
      const doc=await readPdf(file);
      const lines=doc.pages.flatMap(p=>p.lines);
      container.append(el('p',doc.total+' Seiten · '+lines.length+' Textzeilen erkannt'+(doc.truncated?' · nur erste 60 Seiten gelesen':''),'mt-2 text-xs text-slate-500'));
      if(!lines.length){
        container.append(el('p','Dieses PDF enthält keinen auslesbaren Text. Für gescannte Seiten benötigen wir OCR.','mt-3 text-sm text-amber-700'));
      }else{
        const pre=el('pre',lines.slice(0,300).join('\n'),'mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700');
        container.append(pre);
        if(lines.length>300)container.append(el('p','Vorschau auf 300 Textzeilen begrenzt.','mt-2 text-xs text-slate-500'));
        feedbackPanel(container,file.name,lines);
      }
      container.append(el('p','Noch keine verifizierte Produktidentifikation, Marktpreise oder Deal-Übernahme.','mt-3 text-xs text-slate-500'));
    }catch(error){
      container.append(el('p','PDF konnte nicht gelesen werden: '+(error?.message||String(error)),'mt-3 text-sm text-red-700'));
    }
  }
  window.albertScannerIntelligence={showPdf,feedback,recordFeedback,downloadFeedback,feedbackPanel};
})();
