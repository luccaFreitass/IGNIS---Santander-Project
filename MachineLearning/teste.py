import pandas as pd

# Carregar dados da aba ML1
arquivo = "dados_empresas_classificadas.xlsx"
df = pd.read_excel(arquivo, sheet_name="ML1")

def recomendar_produto(row):
    if row["Faixa_risco"] == "Alto" or row["VL_SLDO"] < 0:
        return "Capital de Giro"
    elif row["Perfil_empresa"] == "Expansao" and row["VL_FATU"] > 1_000_000:
        return "Financiamento Investimentos"
    elif row["Perfil_empresa"] == "Madura" and row["Faixa_risco"] == "Baixo":
        return "Investimento PJ"
    elif row["VL_FATU"] < 100_000:
        return "Cartão Corporativo"
    elif "COMERCIO" in row["DS_CNAE"].upper() or "VAREJO" in row["DS_CNAE"].upper():
        return "Antecipação de Recebíveis"
    else:
        return "Capital de Giro"  # fallback padrão

# Criar a nova aba Produtos
df_prod = df.copy()
df_prod["Produto_recomendado"] = df_prod.apply(recomendar_produto, axis=1)

# Salvar no mesmo arquivo, preservando as outras abas
with pd.ExcelWriter(arquivo, mode="a", if_sheet_exists="replace") as writer:
    df_prod.to_excel(writer, sheet_name="Produtos", index=False)

print("[INFO] Aba 'Produtos' criada com recomendações iniciais.")
