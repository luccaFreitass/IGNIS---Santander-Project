import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./cnpjPage.css";

function validarCNPJ(cnpj) {
  // Remove tudo que não for número
  cnpj = cnpj.replace(/\D/g, "");

  // Verifica se tem exatamente 14 números
  return cnpj.length === 14;
}


function Cnpj() {
  const [cnpj, setCnpj] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [perfilPredito, setPerfilPredito] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigate = useNavigate();

  // Proteção para garantir que só usuários autenticados acessem a página
  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (!userType) {
      alert("Usuário não autenticado. Voltando para login.");
      navigate("/");
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();

    const cnpjLimpo = cnpj.trim();

    if (!validarCNPJ(cnpjLimpo)) {
      setErrorMsg("CNPJ inválido. Por favor, verifique e tente novamente.");
      setPerfilPredito(null);
      setApiError(null);
      return;
    }

    setErrorMsg("");
    setIsLoading(true);
    setPerfilPredito(null);
    setApiError(null);

    const cnpjNumeros = cnpjLimpo.replace(/[^\d]+/g, "");

    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cnpj: cnpjNumeros }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail |"Erro desconhecido na API.");
      }

      const data = await response.json();
      setPerfilPredito(data.perfil_predito);

    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="cnpj-page">
      <form id="cnpjForm" onSubmit={handleSubmit}>
        <h1>Consulta de CNPJ</h1>
        <label htmlFor="cnpjInput">Digite o CNPJ:</label>
        <input
          type="text"
          id="cnpjInput"
          name="cnpjInput"
          placeholder="00.000.000/0000-00"
          maxLength={18}
          required
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading? 'Consultando...' : 'Consultar'}
        </button>
      </form>
      {errorMsg && <p className="error-message">{errorMsg}</p>}

      {isLoading && (
        <div className="loading-message">
          <p>Carregando perfil...</p>
        </div>
      )}

      {perfilPredito && (
        <div className="resultado">
          <h3>O perfil previsto para o CNPJ é:</h3>
          <p><strong>{perfilPredito}</strong></p>
        </div>
      )}

      {apiError && (
        <div className="error-message">
          <p>Ocorreu um erro na consulta: {apiError}</p>
        </div>
      )}
    </main>
  );
}

export default Cnpj;