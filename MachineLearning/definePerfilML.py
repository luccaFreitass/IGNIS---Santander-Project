import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# 1. Carregar a planilha
import pandas as pd

df = pd.read_excel(r"D:\Projetos\CHALLENGE 2025 IGNIS\MachineLearning\base_cnpjs_10000.xlsx")
print(df.head())


# 2. Pré-processamento
# Remover colunas irrelevantes ou altamente únicas (CNPJ, IDs, datas)
df_model = df.drop(columns=["CNPJ", "ID", "ID_PGTO", "ID_RCBE", "DT_ABRT", "DT_REFE", "DT_TRAN"])

print(df_model)
# Separar features e target
X = df_model.drop(columns=["Perfil_Empresa"])
y = df_model["Perfil_Empresa"]

# Codificar variáveis categóricas
for col in X.select_dtypes(include="object").columns:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col])

# Escalar variáveis numéricas
scaler = StandardScaler()
X[X.columns] = scaler.fit_transform(X[X.columns])

# 3. Divisão treino/teste
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

# 4. Treinar modelo (Random Forest)
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# 5. Avaliar modelo
y_pred = model.predict(X_test)

print("Acurácia:", accuracy_score(y_test, y_pred))
print("\nRelatório de Classificação:\n", classification_report(y_test, y_pred))
print("\nMatriz de Confusão:\n", confusion_matrix(y_test, y_pred))
