# ===== Importações =====
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
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
ml3_model = None
scaler = None
ds_cnae_map = {}
G = None
grau_centralidade = {}
betweenness_centralidade = {}
closeness_centralidade = {}
empresa_info_cache = {}

# ===== Carregar dados e preparar modelos =====
def carregar_dados():
    global df, df_ml2, ml1_model, ml3_model, scaler, ds_cnae_map
    global G, grau_centralidade, betweenness_centralidade, closeness_centralidade, empresa_info_cache

    # --- ML1 + ML3 no mesmo dataset ---
    df = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML1", dtype={"ID": str})
    df["ID"] = df["ID"].astype(str).str.strip().str.upper()
    df['DS_CNAE'] = df['DS_CNAE'].astype(str).apply(normalizar)
    df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

    # Criar cache de informações das empresas
    for _, row in df.iterrows():
        empresa_info_cache[row["ID"]] = {
            'VL_FATU': row.get('VL_FATU', 0),
            'VL_SLDO': row.get('VL_SLDO', 0),
            'VL_CAR': row.get('VL_CAR', 0),
            'DS_CNAE': row.get('DS_CNAE', '')
        }

    unique_cnae = df['DS_CNAE'].unique()
    ds_cnae_map = {cnae: idx for idx, cnae in enumerate(unique_cnae)}
    df['DS_CNAE_CODE'] = df['DS_CNAE'].map(ds_cnae_map)

    # Escalonar
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[num_cols])
    X = pd.DataFrame(X_scaled, columns=num_cols)
    X['DS_CNAE_CODE'] = df['DS_CNAE_CODE']

    # ===== ML1 =====
    y1 = df[target_col]
    X_train, X_test, y_train, y_test = train_test_split(X, y1, test_size=0.2, random_state=42)
    ml1_model = RandomForestClassifier(n_estimators=200, random_state=42)
    ml1_model.fit(X_train, y_train)
    y_pred = ml1_model.predict(X_test)
    acc1 = accuracy_score(y_test, y_pred)
    print(f"[INFO] Modelo ML1 treinado. Acurácia: {acc1:.2f}")

    # ===== ML3 =====
    if "Produto_recomendado" in df.columns:
        y3 = df['Produto_recomendado']
        Xp_train, Xp_test, yp_train, yp_test = train_test_split(X, y3, test_size=0.2, random_state=42)
        ml3_model = RandomForestClassifier(n_estimators=200, random_state=42)
        ml3_model.fit(Xp_train, yp_train)
        yp_pred = ml3_model.predict(Xp_test)
        acc3 = accuracy_score(yp_test, yp_pred)
        print(f"[INFO] Modelo ML3 (Recomendação de Produtos) treinado. Acurácia: {acc3:.2f}")
    else:
        print("[WARN] Coluna Produto_recomendado não encontrada na aba ML1")

    # ===== ML2 =====
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

# ===== Classificação de Parceiro =====
def classificar_parceiro(vl_unitario, vl_total_receber, saldo, faturamento, vl_car):
    vl_total_receber = max(vl_total_receber, 1)
    saldo = max(saldo, 1)
    faturamento = max(faturamento, 1)
    vl_car = max(vl_car, 1)

    if saldo < faturamento * 0.01:
        saldo_ajustado = faturamento * 0.05
    else:
        saldo_ajustado = saldo

    proporcao_financeira = vl_unitario / vl_total_receber
    fator_tamanho = min(1.0, (vl_unitario / faturamento) * 100)
    impacto_financeiro = (proporcao_financeira * fator_tamanho) * 0.30

    percentual_faturamento = vl_unitario / faturamento
    if percentual_faturamento > 0.1:
        impacto_faturamento = 0.25
    elif percentual_faturamento > 0.05:
        impacto_faturamento = 0.20
    elif percentual_faturamento > 0.02:
        impacto_faturamento = 0.15
    elif percentual_faturamento > 0.01:
        impacto_faturamento = 0.10
    elif percentual_faturamento > 0.005:
        impacto_faturamento = 0.05
    else:
        impacto_faturamento = percentual_faturamento * 10

    liquidez_efetiva = max(saldo_ajustado - vl_car, saldo_ajustado * 0.05, faturamento * 0.03)
    percentual_liquidez = vl_unitario / liquidez_efetiva
    if percentual_liquidez > 0.5:
        impacto_liquidez = 0.25
    elif percentual_liquidez > 0.25:
        impacto_liquidez = 0.20
    elif percentual_liquidez > 0.1:
        impacto_liquidez = 0.15
    elif percentual_liquidez > 0.05:
        impacto_liquidez = 0.10
    elif percentual_liquidez > 0.02:
        impacto_liquidez = 0.05
    else:
        impacto_liquidez = percentual_liquidez * 2.5

    alavancagem = min(vl_car / (saldo_ajustado + 1), 1.5)
    vulnerabilidade_base = (vl_unitario / faturamento) * alavancagem
    if vulnerabilidade_base > 0.1:
        fator_vulnerabilidade = 0.20
    elif vulnerabilidade_base > 0.05:
        fator_vulnerabilidade = 0.15
    elif vulnerabilidade_base > 0.02:
        fator_vulnerabilidade = 0.10
    elif vulnerabilidade_base > 0.01:
        fator_vulnerabilidade = 0.05
    elif vulnerabilidade_base > 0.005:
        fator_vulnerabilidade = 0.02
    else:
        fator_vulnerabilidade = vulnerabilidade_base * 4

    indice = impacto_financeiro + impacto_faturamento + impacto_liquidez + fator_vulnerabilidade

    if indice >= 0.50:
        return "Crítico", round(indice, 4)
    elif indice >= 0.25:
        return "Importante", round(indice, 4)
    else:
        return "Secundário", round(indice, 4)

# ===== Analisar rede ML2 com saldo médio =====
def analisar_rede(cnpj):
    cnpj = cnpj.strip().upper()
    if cnpj not in G.nodes:
        return {"parceiros_totais": 0, "volume_total": 0, "principais_parceiros": [], 
                "centralidade": None, "risco_rede": "Não encontrado"}

    in_edges = list(G.in_edges(cnpj, data=True))
    vl_total_receber = sum([d["weight"] for _, _, d in in_edges])

    # Calcular saldo médio da empresa que recebe
    saldos = []
    empresa_info = empresa_info_cache.get(cnpj, {})
    saldos.append(empresa_info.get('VL_SLDO', 0))
    vl_saldo_medio = np.mean(saldos) if saldos else 0

    parceiros_valores = []
    for u, _, d in in_edges:
        peso = float(d["weight"])
        classificacao, indice = classificar_parceiro(
            vl_unitario=peso,
            vl_total_receber=vl_total_receber,
            saldo=vl_saldo_medio,
            faturamento=empresa_info.get('VL_FATU', 0),
            vl_car=empresa_info.get('VL_CAR', 0)
        )
        parceiros_valores.append({
            "cnpj": u,
            "peso": peso,
            "classificacao": classificacao,
            "indice_criticidade": indice
        })

    parceiros_valores = sorted(parceiros_valores, key=lambda x: x["peso"], reverse=True)

    centralidade = {
        "grau": float(grau_centralidade.get(cnpj, 0)),
        "betweenness": float(betweenness_centralidade.get(cnpj, 0)),
        "closeness": float(closeness_centralidade.get(cnpj, 0))
    }

    risco = "Baixo"
    if centralidade["betweenness"] > 0.1 or len(parceiros_valores) < 2:
        risco = "Alto"
    elif centralidade["grau"] < 0.05:
        risco = "Médio"

    return {
        "parceiros_totais": len(set([p["cnpj"] for p in parceiros_valores])),
        "volume_total": float(vl_total_receber),
        "principais_parceiros": parceiros_valores,
        "centralidade": centralidade,
        "risco_rede": risco,
        "dados_empresa": {
            "faturamento": float(empresa_info.get('VL_FATU', 0)),
            "saldo": float(vl_saldo_medio),
            "vl_car": float(empresa_info.get('VL_CAR', 0))
        }
    }

# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Empresa", version="3.2.0")

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

    empresa = df[df["ID"] == id_input]
    ml1_result = {}
    produto_recomendado = None

    if not empresa.empty:
        # Média do saldo
        vl_sldo_media = empresa["VL_SLDO"].mean()
        row = empresa.iloc[0]
        ds_cnae_code = ds_cnae_map.get(row['DS_CNAE'], -1)

        # Construir input ML1
        X_input = scaler.transform([[row['VL_FATU'], vl_sldo_media, row['IDADE_EMPRESA']]])
        X_input = np.append(X_input, ds_cnae_code).reshape(1, -1)
        perfil_predito = ml1_model.predict(X_input)[0]

        alerta = row.get("PREV", "Nenhuma fraude detectada") or "Nenhuma fraude detectada"
        vl_car = row.get("VL_CAR", 0)
        percentual_pdd = row.get("Percentual_PDD", "0%")
        vl_pdd = calcular_pdd(vl_car, percentual_pdd)
        estado = row.get("Estado", "")

        if ml3_model:
            produto_recomendado = ml3_model.predict(X_input)[0]

        ml1_result = {
            "razaoSocial": "Empresa Fictícia",
            "setor": row['DS_CNAE'],
            "perfil_predito": str(perfil_predito),
            "alertas": str(alerta),
            "VL_CAR": to_native(vl_car),
            "VL_SLDO": to_native(vl_sldo_media),
            "VL_FATU": to_native(row.get("VL_FATU", 0)),
            "Score_cliente": to_native(row.get("Score_cliente", None)),
            "Faixa_risco": row.get("Faixa_risco", None),
            "Percentual_PDD": str(percentual_pdd),
            "VL_PDD": to_native(vl_pdd),
            "Estado": str(estado),
            "Produto_recomendado": str(produto_recomendado) if produto_recomendado else "Não disponível"
        }

    ml2_result = analisar_rede(id_input)

    return {"ID": id_input, "ML1": ml1_result, "ML2": ml2_result}
