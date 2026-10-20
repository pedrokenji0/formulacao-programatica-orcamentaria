const origin='https://imrs.fjp.mg.gov.br';
const html=await (await fetch(origin+'/repositorio/acervo/')).text();
const sources=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))].filter(p=>p.startsWith('/_next/'));
for(const path of sources) {
 const text=await (await fetch(origin+path)).text();
 const hits=[...text.matchAll(/.{0,180}(?:https?:\\?\/\\?\/[^"'\\\s]+|acervo|arquivos|regionalizacoes|baseURL).{0,220}/gi)].map(m=>m[0]);
 if(hits.length) console.log('FJP_SCRIPT:'+JSON.stringify({path,hits:hits.slice(0,70)}));
}
