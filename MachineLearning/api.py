# ===== Importações =====
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import unicodedata
from datetime import datetime
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
import networkx as nx
import os

# ===== Funções auxiliares =====
def normalizar(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('ASCII')
    return s

def calcular_pdd(vl_car, percentual):
    if pd.isna(vl_car) or pd.isna(percentual):
        return 0
    try:
        if isinstance(percentual, str):
            percentual = percentual.replace("%", "").replace(",", ".")
            perc = float(percentual)
            if perc > 1:
                perc = perc / 100
        else:
            perc = float(percentual)
            if perc > 1:
                perc = perc / 100
        return vl_car * perc
    except:
        return 0

# ===== Configurações =====
ARQUIVO_DADOS = "dados_empresas_classificadas.xlsx"
feature_cols = ['VL_FATU', 'VL_SLDO', 'IDADE_EMPRESA', 'DS_CNAE']
num_cols = ['VL_FATU', 'VL_SLDO', 'IDADE_EMPRESA']
target_col = 'Perfil_empresa'

# ===== Variáveis globais =====
ultimo_mod = None
model = None
label_encoders = {}
scaler = None
df = None
df_ml2 = None

# ===== Carregar dados =====
def carregar_dados():
    global df, df_ml2, ultimo_mod
    # Aba ML1
    df = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML1", dtype={"ID": str})
    df["ID"] = df["ID"].astype(str).str.strip()
    df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

    # Aba ML2
    df_ml2 = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML2")
    df_ml2["ID_PGTO"] = df_ml2["ID_PGTO"].astype(str).str.strip()
    df_ml2["ID_RCBE"] = df_ml2["ID_RCBE"].astype(str).str.strip()

    ultimo_mod = os.path.getmtime(ARQUIVO_DADOS)
    print("[INFO] Dados carregados das abas ML1 e ML2.")

# ===== Treinar modelo ML1 =====
def treinar_modelo():
    global model, label_encoders, scaler, df
    X = df[feature_cols].copy()
    y = df[target_col]

    label_encoders = {}
    for col in ['DS_CNAE']:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col])
        label_encoders[col] = le

    scaler = StandardScaler()
    X[num_cols] = scaler.fit_transform(X[num_cols])

    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X, y)
    print("[INFO] Modelo ML1 treinado.")

# ===== Análise ML2 (rede de transações) =====
def analisar_rede(cnpj):
    global df_ml2
    G = nx.DiGraph()
    for _, row in df_ml2.iterrows():
        G.add_edge(row["ID_PGTO"], row["ID_RCBE"], weight=row["VL"])

    if cnpj not in G.nodes:
        return {
            "parceiros_totais": 0,
            "volume_total": 0,
            "principais_parceiros": [],
            "centralidade": None,
            "risco_rede": "Não encontrado"
        }

    parceiros = list(G.successors(cnpj)) + list(G.predecessors(cnpj))
    volume_total = sum([d["weight"] for _, _, d in G.edges(cnpj, data=True)])

    parceiros_valores = []
    for _, target, d in G.out_edges(cnpj, data=True):
        parceiros_valores.append({"cnpj": target, "peso": d["weight"]})
    parceiros_valores = sorted(parceiros_valores, key=lambda x: x["peso"], reverse=True)[:3]

    centralidade = {
        "grau": nx.degree_centrality(G).get(cnpj, 0),
        "betweenness": nx.betweenness_centrality(G).get(cnpj, 0),
        "closeness": nx.closeness_centrality(G).get(cnpj, 0)
    }

    risco = "Baixo"
    if centralidade["betweenness"] > 0.1 or len(parceiros) < 2:
        risco = "Alto"
    elif centralidade["grau"] < 0.05:
        risco = "Médio"

    return {
        "parceiros_totais": len(set(parceiros)),
        "volume_total": volume_total,
        "principais_parceiros": parceiros_valores,
        "centralidade": centralidade,
        "risco_rede": risco
    }

# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Empresa (ML1 + ML2)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ===== Request Model =====
class IDRequest(BaseModel):
    id: str

# ===== Endpoint Unificado =====
@app.post("/predict")
async def predict(data: IDRequest):
    global ultimo_mod, model, label_encoders, scaler, df, df_ml2
    atual_mod = os.path.getmtime(ARQUIVO_DADOS)
    if ultimo_mod is None or atual_mod != ultimo_mod:
        carregar_dados()
        treinar_modelo()

    id_input = data.id.strip()
    print(f"[INFO] CNPJ recebido: {id_input}")

    # ===== ML1 =====
    empresa = df[df["ID"] == id_input]
    ml1_result = {}
    if not empresa.empty:
        empresa_proc = empresa.copy()
        empresa_proc['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(empresa_proc['DT_ABRT'])).dt.days / 365
        for col in ['DS_CNAE']:
            empresa_proc[col] = empresa_proc[col].astype(str).apply(normalizar)
            empresa_proc[col] = label_encoders[col].transform(empresa_proc[col])
        empresa_proc[num_cols] = scaler.transform(empresa_proc[num_cols])
        empresa_proc = empresa_proc[feature_cols]
        perfil_predito = model.predict(empresa_proc)[0]

        alerta = empresa.iloc[0].get("PREV", "")
        if pd.isna(alerta) or str(alerta).strip() == "":
            alerta = "Nenhuma fraude detectada"
        vl_car = empresa.iloc[0].get("VL_CAR", 0)
        percentual_pdd = empresa.iloc[0].get("Percentual_PDD", "0%")
        vl_pdd = calcular_pdd(vl_car, percentual_pdd)
        estado = empresa.iloc[0].get("Estado", "")

        ml1_result = {
            "razaoSocial": "Empresa Fictícia",
            "setor": empresa.iloc[0]["DS_CNAE"],
            "perfil_predito": perfil_predito,
            "alertas": alerta,
            "VL_CAR": vl_car,
            "Score_cliente": empresa.iloc[0].get("Score_cliente", None),
            "Faixa_risco": empresa.iloc[0].get("Faixa_risco", None),
            "Percentual_PDD": percentual_pdd,
            "VL_PDD": vl_pdd,
            "Estado": estado
        }

    # ===== ML2 =====
    ml2_result = analisar_rede(id_input)

    return {
        "ID": id_input,
        "ML1": ml1_result,
        "ML2": ml2_result
    }
