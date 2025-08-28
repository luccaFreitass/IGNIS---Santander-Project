import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx";
import "./comercialPage.css";

function Comercial() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "comercial") {
      alert("Acesso negado.");
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="comercial-page">
      <aside className="sidebar">
        <CnpjWidget onResult={(perfilPredito) => setPerfil(perfilPredito)} />
      </aside>
      <main className="main-content">
        <h1>Área Comercial</h1>
        {perfil ? (
          <p>Perfil previsto: <strong>{perfil}</strong></p>
        ) : (
          <p>Consulte um CNPJ para obter recomendações.</p>
        )}

        <section className="recomendacoes">
          <h2>Recomendações de Produtos</h2>
          <ul>
            <li>Produto A - Indicado para empresas do perfil X</li>
            <li>Produto B - Indicado para empresas do perfil Y</li>
            <li>Produto C - Expansão de crédito</li>
          </ul>
        </section>

        <section className="apontamentos">
          <h2>Apontamentos</h2>
          <p>[Espaço para insights comerciais baseados no CNPJ consultado]</p>
        </section>
      </main>
    </div>
  );
}

export default Comercial;
