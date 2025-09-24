import pandas as pd

# ===== Arquivo de entrada e saída =====
ARQUIVO_DADOS = "dados_empresas_classificadas.xlsx"
NOME_SAIDA = "dados_empresas_produtos.xlsx"
ABA = "ML1"

# Carregar os dados
df = pd.read_excel(ARQUIVO_DADOS, sheet_name=ABA)

# ===== Função de recomendação =====
def recomendar_produto(row):
    # 1. Saldo negativo → Capital de Giro
    if row["VL_SLDO"] < 0:
        return "Capital de Giro"
    
    # 2. Risco alto → Análise Especial
    if row["Faixa_risco"] == "Alto":
        return "Análise Especial"
    
    # 3. Expansão + faturamento alto → Financiamento de Investimentos
    if row["Perfil_empresa"] == "Expansao" and row["VL_FATU"] > 500000:
        return "Financiamento Investimentos"
    
    # 4. Maduro + risco baixo → Investimento PJ
    if row["Perfil_empresa"] == "Madura" and row["Faixa_risco"] == "Baixo":
        return "Investimento PJ"
    
    # 5. Caso contrário → Conta PJ
    return "Conta PJ"

# Aplicar regras
df["Produto_recomendado"] = df.apply(recomendar_produto, axis=1)

# Salvar em um NOVO arquivo Excel
with pd.ExcelWriter(NOME_SAIDA, engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name=ABA, index=False)

print(f"✅ Nova planilha '{NOME_SAIDA}' criada com a aba {ABA} atualizada!")
