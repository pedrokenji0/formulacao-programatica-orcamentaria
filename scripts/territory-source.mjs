import { createHash } from 'node:crypto';
const base = 'https://servicodados.ibge.gov.br/api';
async function get(url) {
  let last;
  for(let attempt=0; attempt<3; attempt++) try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { Accept: 'application/json', 'User-Agent': 'FPO-MG-mapa/1.0' } });
    if (!response.ok) throw new Error(response.status + ' ' + url);
    const text = await response.text();
    return { url, sha256: createHash('sha256').update(text).digest('hex'), data: JSON.parse(text) };
  } catch(error) { last = error; }
  throw last;
}
const [mesh, places] = await Promise.all([
  get(base + '/v3/malhas/estados/31?formato=application%2Fjson&qualidade=minima&intrarregiao=municipio'),
  get(base + '/v1/localidades/estados/31/municipios?orderBy=nome')
]);
const objects = Object.values(mesh.data.objects || {});
const geometries = objects.flatMap(object => object.geometries || []);
if (places.data.length !== 853 || geometries.length !== 853) throw new Error('Esperados 853 municípios: ' + JSON.stringify({ localities: places.data.length, geometries: geometries.length, keys: Object.keys(mesh.data) }));
console.log('IBGE_SUMMARY ' + JSON.stringify({ places: places.data.length, shapes: geometries.length, firstShape: geometries[0], firstPlace: places.data[0], transform: mesh.data.transform, arco: mesh.data.arcs[0].slice(0,3) }));
const payload = JSON.stringify({ fetchedAt: new Date().toISOString(), mesh, places });
for(let offset=0;offset<payload.length;offset+=10000) console.log('FPO_GEO_DATA:' + payload.slice(offset,offset+10000));
