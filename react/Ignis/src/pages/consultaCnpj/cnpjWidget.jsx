import React, { useState } from "react";
import "./cnpjWidget.css";

function CnpjWidget({ onResult }) {
  const [cnpj, setCnpj] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!cnpj.trim()) {
      setErrorMsg("Digite um CNPJ válido.");
      return;
    }

    if (onResult) onResult(cnpj);
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
          placeholder="CNPJ"
        />
        <button type="submit">Consultar</button>
      </form>
      {errorMsg && <p className="error-msg">{errorMsg}</p>}
    </div>
  );
}

export default CnpjWidget;
