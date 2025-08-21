import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
import joblib
import random

# ====== TREINAMENTO ======

# Carregar base (forçando CNPJ como string)
df = pd.read_excel(
    r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\base_cnpjs_10000.xlsx",
    dtype={"CNPJ": str}
)

# Remover colunas irrelevantes
df_model = df.drop(columns=["CNPJ", "ID", "ID_PGTO", "ID_RCBE", "DT_ABRT", "DT_REFE", "DT_TRAN"])

# Separar features e target
X = df_model.drop(columns=["Perfil_Empresa"])
y = df_model["Perfil_Empresa"]

# Codificação de categorias
label_encoders = {}
for col in X.select_dtypes(include="object").columns:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col])
    label_encoders[col] = le  # salvar encoder para usar depois

# Escalar numéricos
scaler = StandardScaler()
X[X.columns] = scaler.fit_transform(X[X.columns])

# Divisão treino/teste
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)

# Treinar modelo
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# Salvar modelo e preprocessadores
joblib.dump(model, "modelo_perfil.pkl")
joblib.dump(label_encoders, "encoders.pkl")
joblib.dump(scaler, "scaler.pkl")

print("Modelo treinado e salvo com sucesso!")

# ====== PREDIÇÃO POR CNPJ ======

# Carregar de novo para simular uso posterior
model = joblib.load("modelo_perfil.pkl")
label_encoders = joblib.load("encoders.pkl")
scaler = joblib.load("scaler.pkl")

# Carregar a base original garantindo CNPJ como string
df_original = pd.read_excel(
    r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\base_cnpjs_10000.xlsx",
    dtype={"CNPJ": str}
)

# Perguntar CNPJ no terminal
cnpj_input = input("Digite o CNPJ da empresa (somente números): ")

# Buscar linha correspondente
empresa = df_original[df_original["CNPJ"] == cnpj_input]

if empresa.empty:
    print("⚠️ CNPJ não encontrado na base. Gerando dados fictícios para simulação...")

    # Criar empresa fictícia
    empresa = pd.DataFrame([{
        "VL_FATU": random.randint(10000, 500000),
        "VL_SLDO": random.uniform(1000, 500000),
        "DS_CNAE": random.choice(["Comércio Varejista", "Indústria", "Serviços", "TI"]),
        "DS_TRAN": random.choice(["Pagamento", "Transferência", "Compra", "Venda"]),
        "VL": random.uniform(100, 50000),
    }])
else:
    print("\n✅ Dados da empresa encontrados:\n", empresa)

    # Preparar dataframe no formato usado no treino
    empresa = empresa.drop(columns=["CNPJ", "ID", "ID_PGTO", "ID_RCBE", "DT_ABRT", "DT_REFE", "DT_TRAN", "Perfil_Empresa"])

# Aplicar encoders
for col in empresa.select_dtypes(include="object").columns:
    if col in label_encoders:  # só transforma se o encoder existir
        le = label_encoders[col]
        empresa[col] = le.transform(empresa[col])

# Escalar
empresa[empresa.columns] = scaler.transform(empresa[empresa.columns])

# Fazer a predição
perfil_predito = model.predict(empresa)[0]

print(f"\n🔎 O perfil previsto para o CNPJ {cnpj_input} é: **{perfil_predito}**")
