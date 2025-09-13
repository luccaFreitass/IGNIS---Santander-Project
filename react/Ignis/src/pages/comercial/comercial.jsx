import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx";
import Loading from "../loading/loading.jsx";
import "./comercialPage.css";

function Comercial() {
  const navigate = useNavigate();
  const [empresaDados, setEmpresaDados] = useState({
    CNPJ: "",
    VL_CAR: 0,
    Faixa_risco: "",
    Estado: "",
  });
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState("");
  const mapRef = useRef();

  // Redireciona se não for usuário comercial
  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "comercial") navigate("/");
  }, [navigate]);

  // Função para buscar dados pelo CNPJ
  const buscarPerfil = async (cnpj) => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cnpj.trim().toUpperCase() }),
      });

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      const data = await response.json();

      setEmpresaDados({
        CNPJ: data.ID || "-",
        VL_CAR: data.ML1?.VL_CAR || 0,
        Faixa_risco: data.ML1?.Faixa_risco || "-",
        Estado: data.ML1?.Estado || "",
      });

      // Aqui você pode gerar insights com base nos dados
      setInsights(
        `Empresa com risco ${data.ML1?.Faixa_risco || "-"} e valor em aberto de R$ ${(
          data.ML1?.VL_CAR || 0
        ).toLocaleString("pt-BR")}.`
      );
    } catch (err) {
      console.error(err);
      setEmpresaDados({
        CNPJ: "",
        VL_CAR: 0,
        Faixa_risco: "",
        Estado: "",
      });
      setInsights("");
      alert("Erro ao consultar API.");
    } finally {
      setLoading(false);
    }
  };

  // Desenhar mapa da localização
  useEffect(() => {
    if (!empresaDados.Estado) return;

    const geoUrl =
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

    d3.json(geoUrl)
      .then((geoData) => {
        d3.select(mapRef.current).selectAll("*").remove();

        const width = 400;
        const height = 250;

        const svg = d3
          .select(mapRef.current)
          .append("svg")
          .attr("width", width)
          .attr("height", height);

        const projection = d3.geoMercator().fitSize([width, height], geoData);
        const path = d3.geoPath().projection(projection);

        // Todos os estados
        svg
          .selectAll("path")
          .data(geoData.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", "transparent")
          .attr("stroke", "#dc2626")
          .attr("stroke-width", 1.5);

        // Destaca o estado
        const estadoDest = geoData.features.find(
          (f) => f.properties.sigla === empresaDados.Estado
        );
        if (estadoDest) {
          svg
            .append("path")
            .datum(estadoDest)
            .attr("d", path)
            .attr("fill", "#dc2626")
            .attr("stroke", "#dc2626")
            .attr("stroke-width", 2);

          const [x, y] = path.centroid(estadoDest);
          svg
            .append("text")
            .attr("x", x)
            .attr("y", y)
            .text(empresaDados.Estado)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("fill", "#fff")
            .attr("font-size", "14px")
            .attr("font-weight", "bold");
        }
      })
      .catch((err) => console.error("Erro carregando GeoJSON:", err));
  }, [empresaDados.Estado]);

  return (
    <div className="comercial-page">
      <aside className="sidebar">
        <CnpjWidget onResult={buscarPerfil} />
      </aside>

      <main className="main-content">
        <h1 className="main-title">Dashboard Comercial</h1>
        {loading && <Loading message="Carregando dados..." />}

        <div className="comercial-indicators">
          <div className="indicator-card animate-slide-up">
            <div className="indicator-icon">💰</div>
            <h3>Valor em Aberto</h3>
            <p className="indicator-value">
              R$ {empresaDados.VL_CAR.toLocaleString()}
            </p>
          </div>
          <div
            className="indicator-card animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="indicator-icon">⚠️</div>
            <h3>Faixa de Risco</h3>
            <p className="indicator-value">
              {empresaDados.Faixa_risco || "-"}
            </p>
          </div>
        </div>

        <div className="card chart-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="chart-header">
            <h2>Localização da Empresa</h2>
            <div className="chart-subtitle">Distribuição geográfica</div>
          </div>
          <div className="map-container">
            <div ref={mapRef} style={{ width: "100%", height: "280px" }}></div>
          </div>
        </div>

        <section className="insights animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <h2>Insights Comerciais</h2>
          <p>{insights || "Consulte um CNPJ para ver os insights."}</p>
        </section>

        <section className="recomendacoes animate-fade-in" style={{ animationDelay: "0.8s" }}>
          <h2>Recomendações de Produtos</h2>
          <p>
            [Aqui será exibida a recomendação do produto mais adequado para a empresa consultada]
          </p>
        </section>
      </main>
    </div>
  );
}

export default Comercial;
