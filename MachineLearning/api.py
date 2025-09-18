# ===== Importações =====
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
import networkx as nx
import numpy as np

# ===== Funções auxiliares =====
def normalizar(s):
    if pd.isna(s):
        return ""
    return str(s).upper()

def calcular_pdd(vl_car, percentual):
    if pd.isna(vl_car) or pd.isna(percentual):
        return 0
    try:
        if isinstance(percentual, str):
            percentual = percentual.replace("%", "").replace(",", ".")
        perc = float(percentual)
        if perc > 1:
            perc = perc / 100
        return float(vl_car) * perc
    except:
        return 0

def to_native(val):
    if isinstance(val, (np.int64, np.int32)):
        return int(val)
    if isinstance(val, (np.float64, np.float32)):
        return float(val)
    return val

# ===== Configurações =====
ARQUIVO_DADOS = "dados_empresas_classificadas.xlsx"
feature_cols = ['VL_FATU', 'VL_SLDO', 'IDADE_EMPRESA', 'DS_CNAE']
num_cols = ['VL_FATU', 'VL_SLDO', 'IDADE_EMPRESA']
target_col = 'Perfil_empresa'

# ===== Variáveis globais =====
df = None
df_ml2 = None
ml1_model = None
scaler = None
ds_cnae_map = {}
G = None
grau_centralidade = {}
betweenness_centralidade = {}
closeness_centralidade = {}

# ===== Carregar dados e preparar modelos =====
def carregar_dados():
    global df, df_ml2, ml1_model, scaler, ds_cnae_map
    global G, grau_centralidade, betweenness_centralidade, closeness_centralidade

    # --- ML1 ---
    df = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML1", dtype={"ID": str})
    df["ID"] = df["ID"].astype(str).str.strip().str.upper()
    df['DS_CNAE'] = df['DS_CNAE'].astype(str).apply(normalizar)
    df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

    unique_cnae = df['DS_CNAE'].unique()
    ds_cnae_map = {cnae: idx for idx, cnae in enumerate(unique_cnae)}
    df['DS_CNAE_CODE'] = df['DS_CNAE'].map(ds_cnae_map)

    # Escalonar apenas para treinar o modelo
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[num_cols])
    X = pd.DataFrame(X_scaled, columns=num_cols)
    X['DS_CNAE_CODE'] = df['DS_CNAE_CODE']
    y = df[target_col]

    ml1_model = RandomForestClassifier(n_estimators=200, random_state=42)
    ml1_model.fit(X, y)
    print("[INFO] Modelo ML1 treinado.")

    # --- ML2 ---
    df_ml2 = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML2")
    df_ml2["ID_PGTO"] = df_ml2["ID_PGTO"].astype(str).str.strip().str.upper()
    df_ml2["ID_RCBE"] = df_ml2["ID_RCBE"].astype(str).str.strip().str.upper()

    G = nx.DiGraph()
    for _, row in df_ml2.iterrows():
        G.add_edge(row["ID_PGTO"], row["ID_RCBE"], weight=float(row["VL"]))

    grau_centralidade = nx.degree_centrality(G)
    betweenness_centralidade = nx.betweenness_centrality(G)
    closeness_centralidade = nx.closeness_centrality(G)
    print("[INFO] Dados ML2 carregados e centralidades pré-calculadas.")

carregar_dados()

# ===== Classificação unitária de parceiros =====
def classificar_parceiro(peso, total_volume):
    if total_volume == 0:
        return "Não classificado"
    rel = peso / total_volume
    if rel >= 0.5:
        return "Crítico"
    elif rel >= 0.2:
        return "Importante"
    else:
        return "Secundário"

# ===== Analisar rede ML2 adaptada =====
def analisar_rede(cnpj):
    cnpj = cnpj.strip().upper()
    if cnpj not in G.nodes:
        return {"parceiros_totais": 0, "volume_total": 0, "principais_parceiros": [], 
                "centralidade": None, "risco_rede": "Não encontrado"}

    parceiros = list(G.successors(cnpj)) + list(G.predecessors(cnpj))
    volume_total = sum([d["weight"] for _, _, d in G.edges(cnpj, data=True)])

    parceiros_valores = []
    for _, t, d in G.out_edges(cnpj, data=True):
        peso = float(d["weight"])
        classificacao = classificar_parceiro(peso, volume_total)
        parceiros_valores.append({"cnpj": t, "peso": peso, "classificacao": classificacao})

    parceiros_valores = sorted(parceiros_valores, key=lambda x: x["peso"], reverse=True)

    centralidade = {
        "grau": float(grau_centralidade.get(cnpj, 0)),
        "betweenness": float(betweenness_centralidade.get(cnpj, 0)),
        "closeness": float(closeness_centralidade.get(cnpj, 0))
    }

    risco = "Baixo"
    if centralidade["betweenness"] > 0.1 or len(parceiros) < 2:
        risco = "Alto"
    elif centralidade["grau"] < 0.05:
        risco = "Médio"

    print("[ML2 DEBUG]", cnpj, parceiros, volume_total, parceiros_valores, centralidade, risco)

    return {
        "parceiros_totais": len(set(parceiros)),
        "volume_total": float(volume_total),
        "principais_parceiros": parceiros_valores,
        "centralidade": centralidade,
        "risco_rede": risco
    }

# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Empresa", version="2.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ===== Request Model =====
class IDRequest(BaseModel):
    id: str

# ===== Endpoint Unificado =====
@app.post("/predict")
async def predict(data: IDRequest):
    id_input = data.id.strip().upper()
    print(f"[INFO] CNPJ recebido: {id_input}")

    # --- ML1 ---
    empresa = df[df["ID"] == id_input]
    ml1_result = {}
    if not empresa.empty:
        row = empresa.iloc[0]
        ds_cnae_code = ds_cnae_map.get(row['DS_CNAE'], -1)

        # Preparar input escalonado apenas para ML1
        X_input = scaler.transform([[row['VL_FATU'], row['VL_SLDO'], row['IDADE_EMPRESA']]]) 
        X_input = np.append(X_input, ds_cnae_code).reshape(1, -1)
        perfil_predito = ml1_model.predict(X_input)[0]

        alerta = row.get("PREV", "Nenhuma fraude detectada") or "Nenhuma fraude detectada"
        vl_car = row.get("VL_CAR", 0)
        vl_sldo = row.get("VL_SLDO", 0)  # USAR VALOR ORIGINAL
        percentual_pdd = row.get("Percentual_PDD", "0%")
        vl_pdd = calcular_pdd(vl_car, percentual_pdd)
        estado = row.get("Estado", "")

        ml1_result = {
            "razaoSocial": "Empresa Fictícia",
            "setor": row['DS_CNAE'],
            "perfil_predito": str(perfil_predito),
            "alertas": str(alerta),
            "VL_CAR": to_native(vl_car),
            "VL_SLDO": to_native(vl_sldo),  # VALOR CORRETO
            "Score_cliente": to_native(row.get("Score_cliente", None)),
            "Faixa_risco": row.get("Faixa_risco", None),
            "Percentual_PDD": str(percentual_pdd),
            "VL_PDD": to_native(vl_pdd),
            "Estado": str(estado)
        }

        print("[ML1 DEBUG]", X_input, ml1_result)

    # --- ML2 ---
    ml2_result = analisar_rede(id_input)

    return {"ID": id_input, "ML1": ml1_result, "ML2": ml2_result}
