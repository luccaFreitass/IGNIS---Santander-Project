import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx";
import "./riscoPage.css";

function Risco() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "risco") {
      alert("Acesso negado.");
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="risco-page">
      <aside className="sidebar">
        <CnpjWidget onResult={(perfilPredito) => setPerfil(perfilPredito)} />
      </aside>
      <main className="main-content">
        <h1>Análise de Risco</h1>
        {perfil ? (
          <p>Perfil previsto: <strong>{perfil}</strong></p>
        ) : (
          <p>Consulte um CNPJ para ver o perfil.</p>
        )}

        <section className="graficos">
          <h2>Gráficos (placeholder)</h2>
          <div className="grafico">[Gráfico de Risco 1]</div>
          <div className="grafico">[Gráfico de Risco 2]</div>
        </section>
      </main>
    </div>
  );
}

export default Risco;
