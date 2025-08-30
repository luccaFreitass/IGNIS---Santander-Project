# ===== Importações =====
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import unicodedata
from datetime import datetime
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
import os

# ===== Função auxiliar =====
def normalizar(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('ASCII')
    return s

# ===== Configurações =====
ARQUIVO_DADOS = "dados_empresas_classificadas.xlsx"
feature_cols = ['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA', 'DS_CNAE', 'DS_TRAN']
num_cols = ['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA']
target_col = 'Perfil_empresa'

# ===== Variáveis globais =====
ultimo_mod = None
model = None
label_encoders = {}
scaler = None
df = None

# ===== Função para carregar e treinar o modelo =====
def treinar_modelo():
    global model, label_encoders, scaler, df, ultimo_mod

    df = pd.read_excel(ARQUIVO_DADOS, dtype={"ID": str})
    df["ID"] = df["ID"].astype(str).str.strip()
    df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

    # Normalizar texto
    for col in ['DS_CNAE', 'DS_TRAN']:
        df[col] = df[col].astype(str).apply(normalizar)

    X = df[feature_cols].copy()
    y = df[target_col]

    # Encoders
    label_encoders = {}
    for col in ['DS_CNAE', 'DS_TRAN']:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col])
        label_encoders[col] = le

    # Escalador
    scaler = StandardScaler()
    X[num_cols] = scaler.fit_transform(X[num_cols])

    # Treinar modelo
    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X, y)

    # Atualizar timestamp da última modificação
    ultimo_mod = os.path.getmtime(ARQUIVO_DADOS)
    print("[INFO] Modelo treinado com os dados atuais da tabela.")

# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Perfil de Empresa", version="1.0.0")

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

# ===== Endpoint =====
@app.post("/predict")
async def predict_perfil(data: IDRequest):
    global ultimo_mod, model, label_encoders, scaler, df

    # Verificar se tabela foi modificada
    atual_mod = os.path.getmtime(ARQUIVO_DADOS)
    if ultimo_mod is None or atual_mod != ultimo_mod:
        print("[INFO] Arquivo modificado ou API iniciada. Treinando modelo...")
        treinar_modelo()

    id_input = data.id.strip()
    print(f"[INFO] CNPJ recebido: {id_input}")

    empresa = df[df["ID"] == id_input]
    if empresa.empty:
        print(f"[INFO] Empresa não encontrada para CNPJ: {id_input}")
        raise HTTPException(status_code=404, detail="Empresa não encontrada na base")

    # Preparar dados
    empresa_proc = empresa.copy()
    empresa_proc['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(empresa_proc['DT_ABRT'])).dt.days / 365

    for col in ['DS_CNAE', 'DS_TRAN']:
        empresa_proc[col] = empresa_proc[col].astype(str).apply(normalizar)
        empresa_proc[col] = label_encoders[col].transform(empresa_proc[col])

    empresa_proc[num_cols] = scaler.transform(empresa_proc[num_cols])
    empresa_proc = empresa_proc[feature_cols]

    # Predição
    perfil_predito = model.predict(empresa_proc)[0]
    print(f"[INFO] Perfil previsto para {id_input}: {perfil_predito}")

    # Tratar alertas (PREV)
    alerta = empresa.iloc[0].get("PREV", "")
    if pd.isna(alerta) or str(alerta).strip() == "":
        alerta = "Nenhuma fraude detectada"

    return {
        "ID": id_input,
        "razaoSocial": "Empresa Fictícia",
        "setor": empresa.iloc[0]["DS_CNAE"],
        "perfil_predito": perfil_predito,
        "alertas": alerta
    }
