"""Valida somente o inventário; não escreve nos dados nem no estado do aplicativo."""
import argparse
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PACKAGE = json.loads((HERE / "datapackage.json").read_text(encoding="utf-8"))
RESOURCES = {r["name"]: r for r in PACKAGE["resources"]}
DEFINITIONS = PACKAGE["x-definitions"]
checks = 0


def check(condition, message):
    global checks
    if not condition:
        raise AssertionError(message)
    checks += 1


def fields(resource):
    return [f["name"] for f in resource["schema"]["fields"]]


def list_of(value):
    return value if isinstance(value, list) else [value]


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def dictionary_paths(field, path):
    yield path
    for child in field.get("x-properties", []):
        yield from dictionary_paths(child, path + "." + child["name"])
    item = field.get("x-items", {})
    if item.get("x-properties"):
        for child in item["x-properties"]:
            yield from dictionary_paths(child, path + "[]." + child["name"])
    elif any(k in item for k in ("x-type-reference", "x-items", "x-values")):
        yield from dictionary_paths(item, path + "[]")
    value = field.get("x-values")
    if value is not None:
        if value.get("x-properties"):
            for child in value["x-properties"]:
                yield from dictionary_paths(child, path + ".*." + child["name"])
        else:
            yield from dictionary_paths(value, path + ".*")


check(len(RESOURCES) == len(PACKAGE["resources"]), "Recursos duplicados")
check(len(DEFINITIONS) == 46, "Quantidade de definições diferente do snapshot")
for resource in RESOURCES.values():
    name = resource["name"]
    names = fields(resource)
    check(len(names) == len(set(names)), f"Campos duplicados: {name}")
    if resource.get("x-inventory-only"):
        check(resource.get("data") == [] and "path" not in resource,
              f"Vista documental não pode simular exportação: {name}")
    for key in list_of(resource["schema"].get("primaryKey", [])):
        check(key in names, f"PK inexistente: {name}.{key}")
    for foreign_key in resource["schema"].get("foreignKeys", []):
        target = RESOURCES.get(foreign_key["reference"].get("resource") or name)
        check(target is not None, f"Recurso FK inexistente: {name}")
        local = list_of(foreign_key["fields"])
        remote = list_of(foreign_key["reference"]["fields"])
        check(len(local) == len(remote), f"Aridade FK: {name}")
        check(all(f in names for f in local), f"Campo local FK: {name}")
        check(all(f in fields(target) for f in remote), f"Campo destino FK: {name}")
    binding = resource.get("x-binding", {})
    for key in ("file", "definition", "dictionary"):
        if key in binding:
            check((ROOT / binding[key]).is_file(), f"Arquivo inexistente: {binding[key]}")
    for obj in walk(resource["schema"]):
        if "x-type-reference" in obj:
            check(obj["x-type-reference"] in DEFINITIONS,
                  f"Definição não encontrada: {obj['x-type-reference']}")
for definition in DEFINITIONS.values():
    check((ROOT / definition["source"]).is_file(), "Arquivo de definição não encontrado")
for module in PACKAGE["x-modules"]:
    check(all(name in RESOURCES for name in module["collections"]),
          f"Coleção inexistente no módulo {module['name']}")
for source in PACKAGE["x-source-status"]:
    check((ROOT / source["file"]).is_file(), f"Fonte não encontrada: {source['file']}")

snapshot = PACKAGE["x-snapshot"]
prefix = ("https://raw.githubusercontent.com/" + snapshot["repository"] + "/"
          + snapshot["commit"] + "/")
for resource in RESOURCES.values():
    if resource.get("format") == "csv" and "path" in resource:
        check(resource["path"].startswith(prefix), "Fonte não fixada no snapshot")
        path = ROOT / resource["path"][len(prefix):]
        text = path.read_bytes().decode(resource.get("encoding", "utf-8")).lstrip("\ufeff")
        reader = csv.reader(io.StringIO(text), delimiter=resource["dialect"]["delimiter"])
        header = next(reader)
        data = [row for row in reader if any(cell != "" for cell in row)]
        check(header == fields(resource), f"Cabeçalho divergente: {path.name}")
        expected = resource.get("x-observed", {}).get("rows")
        if expected is not None:
            check(len(data) == expected, f"Contagem divergente: {path.name}")
        check(all(len(row) == len(header) for row in data), f"Largura CSV: {path.name}")

manifest = snapshot["planningManifest"]
raw_names = {
    "programas": "programas_planejamento.txt",
    "acoes": "acoes_planejamento.txt",
    "indicadores": "indicadores_planejamento.txt",
    "localizadores": "localizadores_Todos_planejamento.txt",
}
for name, filename in raw_names.items():
    raw = (ROOT / "data/raw/plan2026" / filename).read_bytes()
    check(hashlib.sha256(raw).hexdigest() == manifest["sources"][name]["sha256"],
          f"Hash diferente do snapshot (inclusive terminação de linha): {filename}")
planning = json.loads(gzip.decompress((ROOT / "public/data/planning.json.gz").read_bytes()))
check(planning["manifest"]["datasetId"] == manifest["datasetId"], "Dataset PPO divergente")
for name, selector in [
    ("ppo-programas-referencia", "programs"),
    ("ppo-acoes-referencia", "actions"),
    ("ppo-indicadores-referencia", "indicators"),
    ("ppo-localizadores-referencia", "localizers"),
]:
    resource = RESOURCES[name]
    data = planning[selector]
    check(len(data) == resource["x-observed"]["rows"], f"Contagem PPO: {name}")
    check(len({row["id"] for row in data}) == len(data), f"Identidades PPO: {name}")
    check(all(set(row).issubset(fields(resource)) for row in data), f"Campo PPO omitido: {name}")

reurb_dictionary = json.loads((ROOT / "data/referencias/reurb/dicionario.json").read_text())
for table, definition in reurb_dictionary["tabelas"].items():
    resource = RESOURCES["reurb-" + table.replace("_", "-")]
    source = json.loads((ROOT / resource["x-binding"]["file"]).read_text())
    check([f["nome"] for f in definition["campos"]] == fields(resource),
          f"Esquema Reurb: {table}")
    check(len(source["data"]) == resource["x-observed"]["rows"], f"Contagem Reurb: {table}")
    check(all(set(row).issubset(fields(resource)) for row in source["data"]),
          f"Campo Reurb omitido: {table}")

catalog = json.loads((ROOT / "data/territorio/planejamento-projetos.json").read_text())
actions = [a for p in catalog["projects"] for a in p["actions"]]
localizers = [l for a in actions for l in a["localizers"]]
check((len(catalog["projects"]), len(actions), len(localizers)) == (4, 7, 1034),
      "Catálogo territorial diferente do snapshot")
check(catalog["cycle"]["years"] == ["2026", "2027", "2028", "2029"], "Horizonte territorial")
for name, selector in [("seed-saude-obz-items", "obzItems"),
                       ("seed-saude-health-actions", "healthActions")]:
    seed = json.loads((ROOT / "scripts/seed.health.json").read_text())
    check(len(seed[selector]) == RESOURCES[name]["x-observed"]["rows"], f"Contagem seed: {name}")
    check(all(set(row).issubset(fields(RESOURCES[name])) for row in seed[selector]),
          f"Campo seed omitido: {name}")

with (HERE / "dicionario-campos.csv").open(encoding="utf-8", newline="") as handle:
    dictionary = list(csv.DictReader(handle))
expected_paths = {(r["name"], path) for r in RESOURCES.values()
                  for field in r["schema"]["fields"]
                  for path in dictionary_paths(field, field["name"])}
actual_paths = [(row["recurso"], row["campo"]) for row in dictionary]
check(len(actual_paths) == len(set(actual_paths)), "Caminhos duplicados no CSV")
check(set(actual_paths) == expected_paths, "CSV não corresponde aos campos do descritor")
with (HERE / "fontes.csv").open(encoding="utf-8", newline="") as handle:
    source_csv = list(csv.DictReader(handle))
check(len(source_csv) == len(PACKAGE["x-source-status"]), "CSV de fontes incompleto")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--padrao", action="store_true",
                    help="Requer datapackage==1.15.4; usa os esquemas oficiais distribuídos na biblioteca.")
args = parser.parse_args()
if args.padrao:
    from datapackage import Profile
    from jsonschema import Draft4Validator
    schemas = {name: Profile(name).jsonschema for name in
               ("data-package", "tabular-data-resource", "table-schema")}
    def validate_standard(value, name, label):
        errors = list(Draft4Validator(schemas[name]).iter_errors(value))
        for error in errors[:5]:
            print(label, "/".join(map(str, error.path)), error.message[:400])
        check(not errors, f"Esquema oficial: {label}")
    validate_standard(PACKAGE, "data-package", "pacote")
    for resource in RESOURCES.values():
        validate_standard(resource, "tabular-data-resource", resource["name"])
        validate_standard(resource["schema"], "table-schema", resource["name"] + ".schema")
print(json.dumps({"status": "ok", "checks": checks, "resources": len(RESOURCES),
                  "definitions": len(DEFINITIONS), "dictionaryRows": len(dictionary),
                  "officialSchemas": args.padrao}, ensure_ascii=False))
