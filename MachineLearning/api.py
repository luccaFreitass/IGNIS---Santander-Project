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

    # --- ML1 + ML3 ---
    df = pd.read_excel(ARQUIVO_DADOS, sheet_name="ML1", dtype={"ID": str})
    df["ID"] = df["ID"].astype(str).str.strip().str.upper()
    df['DS_CNAE'] = df['DS_CNAE'].astype(str).apply(normalizar)
    df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

    # Criar cache de informações
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
        print(f"[INFO] Modelo ML3 treinado. Acurácia: {acc3:.2f}")
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

# ===== Nova função: Classificar Criticidade da Relação =====
# ===== Nova função: Classificar Criticidade da Relação CORRIGIDA =====
def classificar_criticidade_relacao(tipo, peso, total_grupo, faturamento_empresa, saldo_empresa, vl_car_empresa):
    """
    Classifica a criticidade de uma relação comercial considerando múltiplos fatores
    """
    # Evitar divisão por zero
    total_grupo = max(total_grupo, 1)
    faturamento_empresa = max(faturamento_empresa, 1)
    saldo_empresa = max(saldo_empresa, 1)
    vl_car_empresa = max(vl_car_empresa, 0)
    
    # FATOR 1: Concentração no grupo (dependência)
    concentracao_grupo = (peso / total_grupo) * 100  # Percentual no total do grupo
    
    # FATOR 2: Impacto no faturamento (para recebimentos)
    if tipo == 'receber':
        impacto_faturamento = (peso / faturamento_empresa) * 100
    else:
        impacto_faturamento = 0
    
    # FATOR 3: Impacto na liquidez (para pagamentos)
    if tipo == 'pagar':
        liquidez_disponivel = max(saldo_empresa - vl_car_empresa, saldo_empresa * 0.1)
        impacto_liquidez = (peso / liquidez_disponivel) * 100 if liquidez_disponivel > 0 else 100
    else:
        impacto_liquidez = 0
    
    # FATOR 4: Risco de concentração (quanto maior a participação, maior o risco)
    risco_concentracao = min(concentracao_grupo / 25, 1.0)  # Normalizado para 0-1
    
    # FATOR 5: Impacto financeiro geral
    if tipo == 'receber':
        impacto_financeiro = min(impacto_faturamento / 15, 1.0)  # >15% do faturamento é crítico
    else:
        impacto_financeiro = min(impacto_liquidez / 30, 1.0)  # >30% da liquidez é crítico
    
    # FATOR 6: Importância estratégica (relações muito significativas)
    importancia_estrategica = 1 if concentracao_grupo > 20 else concentracao_grupo / 20
    
    # CÁLCULO DO SCORE FINAL (ponderando os fatores)
    if tipo == 'receber':
        # Para recebimentos: concentração + impacto no faturamento são mais importantes
        score_final = (
            risco_concentracao * 0.4 +
            impacto_financeiro * 0.4 + 
            importancia_estrategica * 0.2
        )
    else:
        # Para pagamentos: impacto na liquidez é mais importante
        score_final = (
            risco_concentracao * 0.3 +
            impacto_financeiro * 0.5 +
            importancia_estrategica * 0.2
        )
    
    # CLASSIFICAÇÃO BASEADA NO SCORE
    if score_final >= 0.7:
        classificacao = "Crítico"
        if tipo == 'receber':
            impacto_desc = f"Perda de {impacto_faturamento:.1f}% do faturamento"
        else:
            impacto_desc = f"Compromete {impacto_liquidez:.1f}% da liquidez"
    elif score_final >= 0.5:
        classificacao = "Alto"
        if tipo == 'receber':
            impacto_desc = f"Impacto significativo no faturamento ({impacto_faturamento:.1f}%)"
        else:
            impacto_desc = f"Alto impacto na liquidez ({impacto_liquidez:.1f}%)"
    elif score_final >= 0.3:
        classificacao = "Moderado"
        impacto_desc = "Impacto moderado nas operações"
    else:
        classificacao = "Baixo"
        impacto_desc = "Impacto limitado"
    
    return classificacao, round(score_final, 3), impacto_desc, {
        'concentracao_grupo': round(concentracao_grupo, 1),
        'impacto_faturamento': round(impacto_faturamento, 1) if tipo == 'receber' else 0,
        'impacto_liquidez': round(impacto_liquidez, 1) if tipo == 'pagar' else 0
    }

# ===== ATUALIZAR função analisar_rede =====
def analisar_rede(cnpj):
    cnpj = cnpj.strip().upper()
    if cnpj not in G.nodes:
        return {
            "parceiros_totais": 0,
            "volume_total": 0,
            "principais_parceiros": [],
            "parceiros_pagar": [],
            "parceiros_receber": [],
            "matriz_risco": [],
            "centralidade": None,
            "risco_rede": "Não encontrado"
        }

    # Buscar informações financeiras da empresa
    info_empresa = empresa_info_cache.get(cnpj, {})
    faturamento = info_empresa.get('VL_FATU', 1)
    saldo = info_empresa.get('VL_SLDO', 1)
    vl_car = info_empresa.get('VL_CAR', 0)

    # --- Empresas que o CNPJ PAGA ---
    out_edges = list(G.out_edges(cnpj, data=True))
    # --- Empresas que o CNPJ RECEBE ---
    in_edges = list(G.in_edges(cnpj, data=True))

    # Cálculo de totais
    total_a_pagar = sum([d["weight"] for _, _, d in out_edges])
    total_a_receber = sum([d["weight"] for _, _, d in in_edges])
    volume_total = total_a_pagar + total_a_receber

    # Classificação de parceiros que a empresa PAGA (fornecedores)
    parceiros_pagar = []
    for _, dest, d in out_edges:
        percentual = (d["weight"] / total_a_pagar * 100) if total_a_pagar > 0 else 0
        
        # Classificar criticidade COM NOVA LÓGICA
        classificacao, score, impacto, detalhes = classificar_criticidade_relacao(
            'pagar', d["weight"], total_a_pagar, faturamento, saldo, vl_car
        )
        
        parceiros_pagar.append({
            "cnpj": dest,
            "peso": d["weight"],
            "percentual": round(percentual, 2),
            "classificacao": classificacao,
            "score_criticidade": score,
            "impacto": impacto,
            "tipo": "fornecedor",
            "risco": "Não Pagar",
            "detalhes": detalhes
        })

    # Classificação de parceiros que a empresa RECEBE (clientes)
    parceiros_receber = []
    for orig, _, d in in_edges:
        percentual = (d["weight"] / total_a_receber * 100) if total_a_receber > 0 else 0
        
        # Classificar criticidade COM NOVA LÓGICA
        classificacao, score, impacto, detalhes = classificar_criticidade_relacao(
            'receber', d["weight"], total_a_receber, faturamento, saldo, vl_car
        )
        
        parceiros_receber.append({
            "cnpj": orig,
            "peso": d["weight"],
            "percentual": round(percentual, 2),
            "classificacao": classificacao,
            "score_criticidade": score,
            "impacto": impacto,
            "tipo": "cliente",
            "risco": "Não Receber",
            "detalhes": detalhes
        })

    return {
        "parceiros_totais": len(out_edges) + len(in_edges),
        "volume_total": volume_total,
        "total_a_pagar": total_a_pagar,
        "total_a_receber": total_a_receber,
        "parceiros_pagar": sorted(parceiros_pagar, key=lambda x: x["score_criticidade"], reverse=True),
        "parceiros_receber": sorted(parceiros_receber, key=lambda x: x["score_criticidade"], reverse=True),
        "centralidade": nx.degree_centrality(G).get(cnpj, 0),
        "risco_rede": "Alto" if total_a_pagar > total_a_receber * 1.5 else "Normal"
    }
# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Empresa", version="3.3.0")
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
        vl_sldo_media = empresa["VL_SLDO"].mean()
        row = empresa.iloc[0]
        ds_cnae_code = ds_cnae_map.get(row['DS_CNAE'], -1)

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

# ===== Health Check =====
@app.get("/")
async def root():
    return {"message": "API de Predição de Empresa - Versão 3.3.0"}

# ===== Health Check Detalhado =====
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": ml1_model is not None,
        "graph_loaded": G is not None,
        "empresas_carregadas": len(df) if df is not None else 0,
        "relacoes_carregadas": len(df_ml2) if df_ml2 is not None else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)