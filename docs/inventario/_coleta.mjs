import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve, relative } from 'node:path';
import ts from 'typescript';
import { readSources } from '../../scripts/planning-import.mjs';

const types = {}, aliases = {}, imports = [], sourceFiles = [];
const typeFiles = ['src/types/index.ts','src/types/planning.ts','src/types/projectMaps.ts','src/types/territory.ts'];
const scalar = node => {
  if (!node) return {type:'any'};
  const text = node.getText();
  if (node.kind === ts.SyntaxKind.StringKeyword) return {type:'string'};
  if (node.kind === ts.SyntaxKind.NumberKeyword) return {type:'number'};
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return {type:'boolean'};
  if (ts.isArrayTypeNode(node)) return {type:'array', 'x-items':scalar(node.elementType)};
  if (ts.isTupleTypeNode(node)) return {type:'array','x-tuple':node.elements.map(scalar)};
  if (ts.isParenthesizedTypeNode(node)) return scalar(node.type);
  if (ts.isLiteralTypeNode(node)) {
    if (node.literal.kind === ts.SyntaxKind.NullKeyword) return {type:'any','x-nullable':true};
    const value = ts.isStringLiteral(node.literal) ? node.literal.text : node.literal.kind === ts.SyntaxKind.TrueKeyword ? true : node.literal.kind === ts.SyntaxKind.FalseKeyword ? false : Number(node.literal.getText());
    return {type:typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',constraints:{enum:[value]}};
  }
  if (ts.isUnionTypeNode(node)) {
    const choices = node.types.map(scalar), present = choices.filter(choice => !choice['x-nullable']);
    const distinct = [...new Set(present.map(choice => choice.type))];
    const result = distinct.length === 1 ? {...present[0]} : {type:'any'};
    if (present.length && present.every(choice => choice.constraints?.enum)) result.constraints = {enum:[...new Set(present.flatMap(choice => choice.constraints.enum))]};
    else if (present.length > 1) delete result.constraints;
    if (choices.some(choice => choice['x-nullable'])) result['x-nullable'] = true;
    if (distinct.length > 1 || present.some(choice => choice['x-type-reference'])) result['x-union'] = present;
    return result;
  }
  if (ts.isTypeLiteralNode(node)) return {type:'object','x-properties':fields(node.members),...(node.members.some(ts.isIndexSignatureDeclaration) ? {'x-dynamic-keys':true} : {})};
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    if (name === 'Record') return {type:'object','x-key-type':node.typeArguments?.[0]?.getText(),'x-values':scalar(node.typeArguments?.[1]),'x-dynamic-keys':true};
    if (name === 'Pick' || name === 'Omit' || name === 'Exclude') return {type:'any','x-typescript':text,'x-generic':name};
    return {type:'object','x-type-reference':name};
  }
  return {type:'any','x-typescript':text};
};
function fields(members) {
  return members.filter(ts.isPropertySignature).map(node => ({name:node.name.getText().replace(/^['"]|['"]$/g,''),...scalar(node.type),'x-optional':!!node.questionToken,'x-typescript':node.type?.getText() || 'unknown'}));
}
for (const path of typeFiles) {
  const ast = ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
  for (const node of ast.statements) {
    if (ts.isInterfaceDeclaration(node)) types[node.name.text] = {name:node.name.text,source:path,fields:fields(node.members),extends:node.heritageClauses?.flatMap(clause => clause.types.map(type => type.getText())) || []};
    if (ts.isTypeAliasDeclaration(node)) aliases[node.name.text] = {name:node.name.text,source:path,schema:scalar(node.type),typescript:node.type.getText()};
  }
}
const profile = rows => {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row || {})))];
  return {rows:rows.length,fields:keys.map(name => { const values = rows.map(row => row?.[name]); const present = values.filter(value => value !== null && value !== undefined && value !== ''); return {name,observedTypes:[...new Set(present.map(value => Array.isArray(value) ? 'array' : typeof value))],missing:values.length - present.length}; })};
};
const input = readSources('data/raw/plan2026');
const raw = Object.fromEntries(Object.entries(input).map(([name,value]) => { const fields = value.headers; const keys = name === 'programas' ? ['Código do Programa'] : name === 'acoes' ? ['Código do Programa','Código da Unidade Orçamentária Responsável pela Ação','Código da Ação'] : name === 'localizadores' ? ['Código do Programa','Código da Unidade Orçamentária Responsável pela Ação','Código da Ação','Código do Localizador'] : ['Código do Programa','Indicador']; return [name,{headers:fields,rows:value.rows.length,sha256:value.sha256,identityCandidate:keys,distinctIdentities:new Set(value.rows.map(row => JSON.stringify(keys.map(key => row[key])))).size}]; }));
const planning = JSON.parse(gunzipSync(readFileSync('public/data/planning.json.gz')));
const official = {};
for (const key of ['programs','actions','indicators','localizers']) {
  official[key] = { ...profile(planning[key]), uniqueIds:new Set(planning[key].map(row => row.id)).size, fieldsKeys:[...new Set(planning[key].flatMap(row => Object.keys(row.officialFields || row.fields || {})))] };
}
official.programStrategicLinks = profile(planning.programs.flatMap(p => p.strategicLinks));
official.localizerTerritories = profile(planning.localizers.flatMap(l => l.territories));
official.territoryFields = [...new Set(planning.localizers.flatMap(l => l.territories.flatMap(t => Object.keys(t.fields))))];
official.territoryStatusFields = [...new Set(planning.localizers.flatMap(l => l.territories.flatMap(t => Object.keys(t.statusFields))))];
const health = JSON.parse(readFileSync('scripts/seed.health.json','utf8'));
const seeds = { keys:Object.keys(health), collections:Object.fromEntries(Object.entries(health).filter(([,v]) => Array.isArray(v)).map(([name,rows]) => [name,profile(rows)])), lists:health.lists ? Object.keys(health.lists) : [], metadata:health.source || health.metadata || null };
const reurb = {};
for (const filename of readdirSync('data/referencias/reurb/data').filter(f => f.endsWith('.json'))) {
  const value = JSON.parse(readFileSync('data/referencias/reurb/data/' + filename,'utf8'));
  reurb[filename] = {keys:Object.keys(value),...profile(value.data || []),metadata:Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'data'))};
}
function walk(path) {
  for (const item of readdirSync(path,{withFileTypes:true})) {
    const file = path + '/' + item.name;
    if (item.isDirectory()) walk(file);
    else if (/\.(tsx?|json)$/.test(item.name)) sourceFiles.push(file);
  }
}
walk('src');
for (const path of sourceFiles.filter(p => /\.tsx?$/.test(p))) {
  const ast = ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const node of ast.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const specifier = node.moduleSpecifier.text;
    let target = specifier;
    if (specifier.startsWith('.')) { const base = resolve(dirname(path),specifier); const found = ['', '.ts','.tsx','.json','/index.ts','/index.tsx'].map(extension => base + extension).find(candidate => existsSync(candidate) && !readdirSync(dirname(candidate)).includes('__never__')); target = found ? relative(process.cwd(),found) : relative(process.cwd(),base); }
    imports.push({from:path,to:target,typeOnly:!!node.importClause?.isTypeOnly});
  }
}
const result = {snapshot:'cfda6499a4130e2889245c6e43a4cede44f4cf62',types,aliases,raw,manifest:planning.manifest,official,health:seeds,reurb,imports};
console.log('INVENTARIO_INICIO');
console.log(JSON.stringify(result));
console.log('INVENTARIO_FIM');
