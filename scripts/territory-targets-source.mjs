import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
const origin='https://imrs.fjp.mg.gov.br', api='https://apiimrs.fjp.mg.gov.br/';
const js=await(await fetch(origin+'/_next/static/chunks/app/(web)/repositorio/acervo/page-16593350f8032646.js')).text();
const start=js.indexOf('27961:function');
const module=js.slice(start,js.indexOf('}},2140',start));
console.log('FJP_MODULE:'+module.slice(0,9000));
const endpoints=[...module.matchAll(/\(0,\w+\.get\)\("([^"]+)"/g)].map(m=>m[1]);
console.log('FJP_ENDPOINTS:'+JSON.stringify(endpoints));
for(const endpoint of endpoints){
 const response=await fetch(api+endpoint); if(!response.ok){console.log('FJP_STATUS:'+response.status);continue;}
 const body=await response.json();
 const arrays=[]; const walk=(x)=>{if(Array.isArray(x)){arrays.push(x);x.forEach(walk);}else if(x&&typeof x==='object')Object.values(x).forEach(walk);};walk(body);
 const records=arrays.flat().filter(x=>x&&typeof x==='object'&&x.slug&&x.pathfile);
 console.log('FJP_CATALOG:'+JSON.stringify(records.map(({id,name,description,slug,pathfile,ext,created_at,updated_at})=>({id,name,description,slug,pathfile,ext,created_at,updated_at}))));
 const file=records.find(x=>String(x.slug).includes('regionalizacoes-dos-municipios-de-minas-gerais'));
 if(file){
  const url=new URL(file.pathfile,api).href;
  const r=await fetch(url);if(!r.ok)throw new Error('XLSX '+r.status);
  const bytes=Buffer.from(await r.arrayBuffer()),book=XLSX.read(bytes,{type:'buffer'});
  const payload={sourceUrl:url,name:file.name,fileName:file.slug+'.'+file.ext,description:file.description,sha256:createHash('sha256').update(bytes).digest('hex'),fetchedAt:new Date().toISOString(),catalogUrl:api+endpoint,sheets:book.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:true})}))};
  const text=JSON.stringify(payload);console.log('FJP_WORKBOOK_SUMMARY:'+JSON.stringify({name:payload.fileName,sheets:payload.sheets.map(s=>({name:s.name,count:s.rows.length,first:s.rows.slice(0,10)}))}));
  for(let offset=0;offset<text.length;offset+=10000)console.log('FJP_WORKBOOK_DATA:'+text.slice(offset,offset+10000));
 }
}
