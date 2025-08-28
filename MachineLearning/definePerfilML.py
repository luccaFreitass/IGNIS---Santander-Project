import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

# ===== CARREGAR BASE =====
df = pd.read_excel(r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\dados_empresas_classificadas.xlsx", dtype={"ID": str})

# ===== CRIAR COLUNA IDADE EMPRESA =====
df['IDADE_EMPRESA'] = (datetime.now() - pd.to_datetime(df['DT_ABRT'])).dt.days / 365

# ===== SELECIONAR FEATURES E TARGET =====
entradas = df[['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA', 'DS_CNAE', 'DS_TRAN']]
classes = df['Perfil_empresa']

# ===== CODIFICAR COLUNAS CATEGÓRICAS =====
label_encoders = {}
for col in ['DS_CNAE', 'DS_TRAN']:
    le = LabelEncoder()
    entradas[col] = le.fit_transform(entradas[col].astype(str))
    label_encoders[col] = le

# ===== ESCALAR COLUNAS NUMÉRICAS =====
num_cols = ['VL_FATU', 'VL_SLDO', 'VL', 'IDADE_EMPRESA']
scaler = StandardScaler()
entradas[num_cols] = scaler.fit_transform(entradas[num_cols])

# ===== DIVISÃO TREINO/TESTE =====
X_train, X_test, y_train, y_test = train_test_split(
    entradas, classes, test_size=0.2, random_state=42, stratify=classes
)

# ===== TREINAR MODELO RANDOM FOREST =====
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# ===== PREDIÇÃO E AVALIAÇÃO =====
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"Accuracy do modelo: {acc:.4f}")
print("Matriz de confusão:")
print(confusion_matrix(y_test, y_pred))
