import pandas as pd

# Arquivo e aba
arquivo = "dados_empresas_classificadas.xlsx"
df = pd.read_excel(arquivo, sheet_name="ML1")

# Lista dos campos simulados que devem ser uniformizados
campos_simulados = ["VL_CAR", "Score_cliente", "Faixa_risco", "Percentual_PDD", "Estado"]

# Padronizar os dados simulados por ID (CNPJ)
for campo in campos_simulados:
    df[campo] = df.groupby("ID")[campo].transform("first")

# Salvar em um novo arquivo para não sobrescrever o original
saida = "dados_empresas_classificadas_corrigido.xlsx"
df.to_excel(saida, sheet_name="ML1", index=False)

print(f"Tabela corrigida salva em {saida}")
