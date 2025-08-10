import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./cnpjPage.css";

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g, "");

  if (cnpj.length !== 14) return false;

  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(1))) return false;

  return true;
}

function Cnpj() {
  const [cnpj, setCnpj] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  // Proteção para garantir que só usuários autenticados acessem a página
  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (!userType) {
      alert("Usuário não autenticado. Voltando para login.");
      navigate("/");
    }
  }, [navigate]);

  function handleSubmit(e) {
    e.preventDefault();

    const cnpjLimpo = cnpj.trim();

    if (!validarCNPJ(cnpjLimpo)) {
      setErrorMsg("CNPJ inválido. Por favor, verifique e tente novamente.");
      return;
    }

    setErrorMsg("");

    const cnpjNumeros = cnpjLimpo.replace(/[^\d]+/g, "");

    const userType = sessionStorage.getItem("userType");

    if (!userType) {
      alert("Usuário não autenticado. Voltando para login.");
      navigate("/");
      return;
    }

    if (userType === "risco") {
      navigate(`/risco?cnpj=${cnpjNumeros}`);
    } else if (userType === "comercial") {
      navigate(`/comercial?cnpj=${cnpjNumeros}`);
    } else {
      alert("Tipo de usuário desconhecido. Voltando para login.");
      navigate("/");
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
        <button type="submit">Consultar</button>
      </form>
      <p className="error-message">{errorMsg}</p>
    </main>
  );
}

export default Cnpj;
