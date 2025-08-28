import React, { useState } from "react";
import "./cnpjWidget.css";

function CnpjWidget({ onResult }) {
  const [cnpj, setCnpj] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setErrorMsg("");

    try {
      // Ajuste: enviar campo "id" em vez de "cnpj"
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cnpj }), 
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      if (onResult) onResult(data.perfil_predito);
    } catch (err) {
      setErrorMsg("Erro ao consultar API.");
      console.error(err);
    }
  }

  return (
    <div className="cnpj-widget">
      <form onSubmit={handleSubmit}>
        <label htmlFor="cnpjInput">CNPJ:</label>
        <input
          type="text"
          id="cnpjInput"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="CNPJ_00004"
        />
        <button type="submit">Consultar</button>
      </form>
      {errorMsg && <p className="error-msg">{errorMsg}</p>}
    </div>
  );
}

export default CnpjWidget;
