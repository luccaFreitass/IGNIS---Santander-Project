# ===== API FASTAPI COMPLETA =====
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import random
import joblib
import unicodedata
from datetime import datetime

# ===== Função auxiliar =====
def normalizar(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('ASCII')
    return s

# ===== Inicializar API =====
app = FastAPI(title="API de Predição de Perfil de Empresa", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ===== Carregar modelo e objetos =====
model = joblib.load("modelo_perfil.pkl")
label_encoders = joblib.load("encoders.pkl")
scaler = joblib.load("scaler.pkl")

# Carregar base original (para IDs e dados)
df_original = pd.read_excel(
    r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\dados_empresas_classificadas.xlsx",
    dtype={"ID": str}
)
df_original["ID"] = df_original["ID"].astype(str).str.strip()

# Colunas usadas como features no modelo
feature_cols = ['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA', 'DS_CNAE', 'DS_TRAN']
num_cols = ['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA']

# ===== Request Model =====
class IDRequest(BaseModel):
    id: str

# ===== Endpoint =====
@app.post("/predict")
async def predict_perfil(data: IDRequest):
    id_input = data.id.strip()

    # Filtrar empresa pelo ID
    empresa = df_original[df_original["ID"] == id_input]

    if empresa.empty:
        # Criar empresa fictícia caso não exista
        empresa_proc = pd.DataFrame([{
            "VL_FATU": random.randint(10000, 500000),
            "VL_SLDO": random.uniform(1000, 500000),
            "VL": random.uniform(100, 50000),
            "IDADE_EMPRESA": random.uniform(0.5, 20),
            "DS_CNAE": random.choice(list(label_encoders['DS_CNAE'].classes_)),
            "DS_TRAN": random.choice(list(label_encoders['DS_TRAN'].classes_))
        }])
    else:
        # Preparar dados da empresa existente
        drop_cols = ["ID","ID_PGTO","ID_RCBE","DT_ABRT","DT_REFE","DT_REFE.1","DT_TRAN","Perfil_empresa"]
        empresa_proc = empresa.drop(columns=[c for c in drop_cols if c in empresa.columns])
        empresa_proc = empresa_proc.reset_index(drop=True)

        # Criar idade da empresa se não existir
        if "IDADE_EMPRESA" not in empresa_proc.columns and "DT_ABRT" in empresa.columns:
            empresa_proc['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(empresa['DT_ABRT'])).dt.days / 365

        # Normalizar strings
        for col in ['DS_CNAE','DS_TRAN']:
            empresa_proc[col] = empresa_proc[col].apply(normalizar)

    # Aplicar encoders
    for col in ['DS_CNAE','DS_TRAN']:
        empresa_proc[col] = label_encoders[col].transform(empresa_proc[col])

    # Escalar colunas numéricas
    empresa_proc[num_cols] = scaler.transform(empresa_proc[num_cols])

    # Garantir que as colunas estão na mesma ordem do treino
    empresa_proc = empresa_proc[feature_cols]

    # Predição
    perfil_predito = model.predict(empresa_proc)[0]

    return {"perfil_predito": perfil_predito}
