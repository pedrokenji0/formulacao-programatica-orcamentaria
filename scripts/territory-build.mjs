import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildTerritory(source) {
  const topology = source.mesh.data;
  const geometries = Object.values(topology.objects).flatMap((object) => object.geometries);
  const places = new Map(source.places.data.map((place) => [String(place.id), place]));
  if (places.size !== 853 || geometries.length !== 853) throw new Error('Esperados 853 municípios.');
  const geographicArcs = topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      const lon = x * topology.transform.scale[0] + topology.transform.translate[0];
      const lat = y * topology.transform.scale[1] + topology.transform.translate[1];
      return [lon * Math.PI / 180, -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
    });
  });
  const points = geographicArcs.flat();
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const width = 900, height = 640, margin = 22;
  const scale = Math.min((width - 2 * margin) / (maxX - minX), (height - 2 * margin) / (maxY - minY));
  const dx = (width - (maxX - minX) * scale) / 2, dy = (height - (maxY - minY) * scale) / 2;
  const arcs = geographicArcs.map((arc) => arc.map(([x, y]) => [Number(((x - minX) * scale + dx).toFixed(2)), Number(((y - minY) * scale + dy).toFixed(2))]));
  const path = (points) => points.map(([x, y], i) => (i ? 'L' : 'M') + x + ',' + y).join('');
  const municipalities = geometries.map((geometry) => {
    const code = String(geometry.properties.codarea);
    const place = places.get(code);
    if (!place) throw new Error('Código da malha ausente no catálogo: ' + code);
    const rings = geometry.type === 'Polygon' ? geometry.arcs : geometry.type === 'MultiPolygon' ? geometry.arcs.flat() : [];
    if (!rings.length) throw new Error('Geometria não poligonal.');
    const ringPoints = rings.map((ring) => ring.flatMap((id, i) => {
      const points = id < 0 ? [...arcs[~id]].reverse() : arcs[id];
      return i ? points.slice(1) : points;
    }));
    const points = ringPoints.flat(), x = points.map(([x]) => x), y = points.map(([, y]) => y);
    const immediate = place['regiao-imediata'], intermediate = immediate['regiao-intermediaria'];
    return { code, name: place.nome, path: ringPoints.map((points) => path(points) + 'Z').join(''), bounds: [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)], arcs: [...new Set(rings.flat().map((id) => id < 0 ? ~id : id))],
      immediate: { code: String(immediate.id), name: immediate.nome }, intermediate: { code: String(intermediate.id), name: intermediate.nome } };
  }).sort((a, b) => a.code.localeCompare(b.code));
  if (new Set(municipalities.map((m) => m.code)).size !== 853) throw new Error('Municípios repetidos.');
  return { schemaVersion: 1, width, height, source: { institution: 'IBGE', fetchedAt: source.fetchedAt, meshUrl: source.mesh.url, localitiesUrl: source.places.url, meshSha256: source.mesh.sha256, localitiesSha256: source.places.sha256, quality: 'minima' }, municipalities, arcs: arcs.map(path) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync('data/territorio/fonte-ibge.json', 'utf8'));
  const data = buildTerritory(source);
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/mg-municipios.json', JSON.stringify(data) + '\n');
  writeFileSync('data/territorio/municipios.json', JSON.stringify(data.municipalities.map(({ path, bounds, arcs, ...catalog }) => catalog), null, 2) + '\n');
  console.log('Malha IBGE: ' + data.municipalities.length + ' municípios.');
}
