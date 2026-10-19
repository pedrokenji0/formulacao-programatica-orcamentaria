from pathlib import Path
import pandas as pd

def carregar_dataframes(pasta=None):
    """Carrega JSON orient=table e cria visões por tipo sem duplicar a fonte canônica."""
    raiz = Path(pasta) if pasta is not None else Path(__file__).resolve().parent
    dfs = {p.stem: pd.read_json(p, orient="table") for p in sorted((raiz / "data").glob("*.json"))}
    for nome, tipo in {"contexto":"contexto", "recursos":"recurso", "atividades":"atividade", "produtos":"produto", "resultados":"resultado", "impactos":"impacto", "pressupostos":"pressuposto"}.items():
        dfs[nome] = dfs["componentes"].loc[dfs["componentes"]["tipo"].eq(tipo)].copy().reset_index(drop=True)
    return dfs

if __name__ == "__main__":
    dfs = carregar_dataframes()
    for nome, df in dfs.items():
        print(f"df_{nome}: {len(df)} linhas, {len(df.columns)} colunas")
    print("\nAções do mapa único do Reurb:")
    print(dfs["mapas"].merge(dfs["projeto_acoes"], on="projeto_id", validate="one_to_many").merge(dfs["acoes"], on="acao_id", validate="many_to_one")[["mapa_id", "codigo_programa", "codigo_uo", "codigo_acao"]].to_string(index=False))
