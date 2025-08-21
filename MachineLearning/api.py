# Conteúdo do arquivo MachineLearning/api.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import random # Importar random para geração de dados fictícios

# 1. Carregar os objetos de ML e a base de dados original na inicialização
try:
    model = joblib.load("modelo_perfil.pkl")
    label_encoders = joblib.load("encoders.pkl")
    scaler = joblib.load("scaler.pkl")
    # Carregar a base de dados original, garantindo CNPJ como string
    df_original = pd.read_excel(
        "base_cnpjs_10000.xlsx", # Assumindo que a base está no mesmo diretório ou acessível
        dtype={"CNPJ": str}
    )
except FileNotFoundError:
    raise RuntimeError("Arquivos necessários (modelo_perfil.pkl, encoders.pkl, scaler.pkl ou base_cnpjs_10000.xlsx) não encontrados. Verifique se estão no diretório correto e se o script de treinamento foi executado.")

app = FastAPI(
    title="API de Predição de Perfil de Empresa",
    version="1.0.0"
)

# 2. Habilitar CORS para o front-end
# Adapte esta lista com as origens do seu frontend (e.g., "http://localhost:3000", "http://localhost:5173")
origins = ["*"] # Para desenvolvimento, '*' permite todas as origens. Em produção, restrinja.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"], # Permite todos os cabeçalhos
)

# 3. Definir o modelo de dados de entrada (apenas CNPJ para a API)
class CNPJRequest(BaseModel):
    cnpj: str

# 4. Criar o endpoint de predição
@app.post("/predict")
async def predict_perfil(data: CNPJRequest):
    """
    Recebe um CNPJ, busca os dados da empresa na base e retorna o perfil de risco previsto.
    Se o CNPJ não for encontrado, gera dados fictícios para simulação e predição.
    """
    cnpj_input = data.cnpj.strip()

    # Buscar linha correspondente na base de dados
    empresa = df_original[df_original["CNPJ"] == cnpj_input]

    if empresa.empty:
        # Se CNPJ não encontrado, criar empresa fictícia para simulação
        print(f"⚠️ CNPJ {cnpj_input} não encontrado na base. Gerando dados fictícios para simulação...")
        # As colunas devem corresponder às que o modelo espera (VL_FATU, VL_SLDO, DS_CNAE, DS_TRAN, VL)
        empresa_para_predicao = pd.DataFrame([{
            "VL_FATU": random.randint(10000, 500000),
            "VL_SLDO": random.uniform(1000, 500000),
            "DS_CNAE": random.choice(["Comércio Varejista", "Indústria", "Serviços", "TI"]),
            "DS_TRAN": random.choice(["Pagamento", "Transferência", "Compra", "Venda"]),
            "VL": random.uniform(100, 50000),
        }])
    else:
        print(f"\n✅ Dados da empresa encontrados para CNPJ {cnpj_input}.")
        # Preparar dataframe no formato usado no treino
        # REMOVER as colunas usadas para identificação e datas, e o target 'Perfil_Empresa'
        # Esta lista de colunas deve corresponder exatamente às colunas removidas no treinamento.
        columns_to_drop = ["CNPJ", "ID", "ID_PGTO", "ID_RCBE", "DT_ABRT", "DT_REFE", "DT_TRAN", "Perfil_Empresa"]
        empresa_para_predicao = empresa.drop(columns=columns_to_drop)
        # Resetar o índice para garantir que o dataframe está pronto para transformação
        empresa_para_predicao = empresa_para_predicao.reset_index(drop=True)


    try:
        # Aplicar LabelEncoder aos dados categóricos
        for col in empresa_para_predicao.select_dtypes(include="object").columns:
            if col in label_encoders:
                le = label_encoders[col]
                # Verifica se o valor da categoria existe no encoder treinado
                # Se não existir, é um valor novo e não pode ser transformado diretamente.
                # Podemos optar por levantar um erro ou atribuir um valor padrão/desconhecido.
                # Neste caso, vamos retornar uma mensagem específica.
                if empresa_para_predicao[col].iloc[0] not in le.classes_:
                    raise HTTPException(status_code=400, detail=f"Categoria '{empresa_para_predicao[col].iloc[0]}' na coluna '{col}' não reconhecida pelo modelo. Por favor, forneça uma categoria válida.")
                empresa_para_predicao[col] = le.transform(empresa_para_predicao[col])
            else:
                # Se uma coluna de objeto não tiver um encoder salvo, pode ser um erro de configuração
                raise HTTPException(status_code=500, detail=f"Encoder para a coluna categórica '{col}' não encontrado. Verifique a configuração dos encoders.")

        # Aplicar StandardScaler aos dados numéricos
        # O modelo espera os dados em um array NumPy.
        # Ensure the column order matches the training data if not explicitly handled by feature names
        # For simplicity, assuming column order is consistent after dropping.
        scaled_data = scaler.transform(empresa_para_predicao)

        # Fazer a predição
        perfil_predito = model.predict(scaled_data)[0] # [0] para obter o valor único da predição

        return {"perfil_predito": perfil_predito}
    except HTTPException as http_exc:
        raise http_exc # Levantar exceções HTTP diretamente
    except Exception as e:
        # Capturar qualquer outra exceção e retornar um erro 500
        raise HTTPException(status_code=500, detail=f"Erro interno ao processar a predição: {str(e)}")

