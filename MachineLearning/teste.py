import pandas as pd
import random

# ============================
# Configuração de arquivos
# ============================
ARQUIVO_ORIGINAL = r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\dados_empresas_classificadas.xlsx"
ARQUIVO_NOVO = r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\dados_empresas_classificadas_simulado.xlsx"

# ============================
# Carregar Excel e listar abas
# ============================
xls = pd.ExcelFile(ARQUIVO_ORIGINAL)
print("Abas disponíveis:", xls.sheet_names)

# Se souber o nome exato da aba, troque aqui
# df = pd.read_excel(ARQUIVO_ORIGINAL, sheet_name="dados_empresas_classificadas")
# Se quiser sempre pegar a primeira aba:
df = pd.read_excel(ARQUIVO_ORIGINAL, sheet_name=0)

# ============================
# Funções auxiliares
# ============================
def gerar_score():
    return random.randint(400, 800)

def faixa_risco(score):
    if score >= 700:
        return "Baixo", "2%"
    elif score >= 600:
        return "Médio", "5%"
    else:
        return "Alto", "15%"

def gerar_valor_carteira(faturamento):
    return round(faturamento * random.uniform(0.05, 0.5), 2)

def gerar_estado():
    estados = ["SP", "RJ", "MG", "RS", "MT", "BA", "PR", "SC", "PE", "GO"]
    return random.choice(estados)

# ============================
# Preencher dados faltantes
# ============================
for idx, row in df.iterrows():
    if pd.isna(row.get("Score_cliente")):  # só preenche se estiver vazio
        score = gerar_score()
        risco, pdd = faixa_risco(score)
        df.at[idx, "Score_cliente"] = score
        df.at[idx, "Faixa_risco"] = risco
        df.at[idx, "Percentual_PDD"] = pdd
        df.at[idx, "VL_CAR"] = gerar_valor_carteira(row["VL_FATU"])
        df.at[idx, "Estado"] = gerar_estado()

# ============================
# Salvar nova planilha
# ============================
df.to_excel(ARQUIVO_NOVO, sheet_name="dados_empresas_classificadas_simulado", index=False)

print(f"✅ Arquivo salvo em: {ARQUIVO_NOVO}")
