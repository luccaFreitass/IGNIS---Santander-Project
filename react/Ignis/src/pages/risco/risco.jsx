import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx";
import Loading from "../loading/loading.jsx"; 
import "./riscoPage.css";

function Risco() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState("");
  const [empresaDados, setEmpresaDados] = useState({
    CNPJ: "",
    razaoSocial: "",
    setor: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "risco") {
      alert("Acesso negado.");
      navigate("/");
    }
  }, [navigate]);

  const buscarPerfil = async (cnpj) => {
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cnpj.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("Resposta inválida da API: não é JSON");
      }

      setEmpresaDados({
        CNPJ: data.ID || "-",
        razaoSocial: data.razaoSocial || "-",
        setor: data.setor || "-",
        alertas: data.alertas || "",
      });

      setPerfil(data.perfil_predito || "-");
      console.log("DEBUG perfil:", data.perfil_predito);
    } catch (err) {
      console.error(err);
      setEmpresaDados({ CNPJ: "", razaoSocial: "", setor: "" });
      setPerfil("");
      alert("Erro ao consultar API. Verifique se a API está rodando corretamente.");
    } finally {
      setLoading(false);
    }
  };

  // Classes de cor
  const getDotClass = (perfil) => {
    if (!perfil) return "";
    switch (perfil.toLowerCase()) {
      case "madura":
        return "madura";
      case "expansao":
        return "expansao";
      case "inicio":
        return "inicio";
      case "declinio":
        return "declinio";
      default:
        return "";
    }
  };

  const colorMap = {
 
  };

  return (
    <div className="risco-page">
      <aside className="sidebar">
        <CnpjWidget onResult={buscarPerfil} />
      </aside>

      <main className="main-content">
        <h1 className="main-title">Análise de Risco</h1>

        {loading && <Loading message="Carregando dados..." />}

        <div
          className="dashboard-grid"
          style={{ filter: loading ? "blur(2px)" : "none" }}
        >
          <div className="card info-card">
            <h2>Dados da Empresa</h2>
            <p><strong>CNPJ:</strong> {empresaDados.CNPJ}</p>
            <p><strong>Razão Social:</strong> {empresaDados.razaoSocial}</p>
            <p>
              <strong>Perfil:</strong>{" "}
              <span
                className={`perfil-text ${getDotClass(perfil)}`}
                style={{
                  color: colorMap[perfil?.toLowerCase()] || undefined,
                }}
              >
                {perfil || "-"}
              </span>
              {perfil && (
                <span
                  className={`dot ${getDotClass(perfil)}`}
                  aria-hidden="true"
                />
              )}
            </p>
            <p><strong>Setor:</strong> {empresaDados.setor}</p>
            <p>
            <strong>Alertas de Fraude:</strong>{" "}
            {empresaDados.alertas && empresaDados.alertas.trim() !== "" ? (
              <span id="alertaIdentificado">
                {empresaDados.alertas}
              </span>
            ) : (
              <span id="semAlertas">
                Nenhuma fraude detectada
              </span>
            )}
          </p>


          </div>

          <div className="card chart-card">
            <h2>Evolução de Indicadores de Risco</h2>
            <div className="chart-placeholder">[Gráfico de Linha D3]</div>
          </div>

          <div className="card chart-card">
            <h2>Distribuição dos Riscos</h2>
            <div className="chart-placeholder">[Gráfico de Pizza D3]</div>
          </div>

          <div className="card chart-card">
            <h2>Parceiros</h2>
            <div className="chart-placeholder">[Mapa ou Rede de Parceiros]</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Risco;
