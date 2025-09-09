import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx";
import Loading from "../loading/loading.jsx"; 
import ModalFraude from "../modalFraude/modalFraude.jsx"; 
import "./riscoPage.css";

function Risco() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState("");
  const [empresaDados, setEmpresaDados] = useState({
    CNPJ: "",
    razaoSocial: "",
    setor: "",
    alertas: "",
    VL_CAR: 0,
    Score_cliente: null,
    Faixa_risco: "",
    Percentual_PDD: "0%",
    VL_PDD: 0,
    Estado: ""
  });
  const [ml2Dados, setMl2Dados] = useState({});
  const [loading, setLoading] = useState(false);
  const [fraudeMessage, setFraudeMessage] = useState("");

  const barRef = useRef();
  const gaugeRef = useRef();
  const radarRef = useRef();
  const mapRef = useRef();

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "risco") navigate("/");
  }, [navigate]);

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

      console.log("[DEBUG] ML1:", data.ML1);
      console.log("[DEBUG] ML2:", data.ML2);

      setEmpresaDados({
        CNPJ: data.ID || "-",
        razaoSocial: data.ML1?.razaoSocial || "Empresa Fictícia",
        setor: data.ML1?.setor || "-",
        alertas: data.ML1?.alertas || "Nenhuma fraude detectada",
        VL_CAR: data.ML1?.VL_CAR || 0,
        Score_cliente: data.ML1?.Score_cliente || null,
        Faixa_risco: data.ML1?.Faixa_risco || "-",
        Percentual_PDD: data.ML1?.Percentual_PDD || "0%",
        VL_PDD: data.ML1?.VL_PDD || 0,
        Estado: data.ML1?.Estado || ""
      });

      setMl2Dados(data.ML2 || {});
      setPerfil(data.ML1?.perfil_predito || "-");

      // Mostrar alerta de fraude se houver
      if (data.ML1?.alertas && data.ML1.alertas !== "nan") {
        setFraudeMessage(data.ML1.alertas);
      } else {
        setFraudeMessage("");
      }

    } catch (err) {
      console.error(err);
      setEmpresaDados({
        CNPJ: "",
        razaoSocial: "",
        setor: "",
        alertas: "",
        VL_CAR: 0,
        Score_cliente: null,
        Faixa_risco: "",
        Percentual_PDD: "0%",
        VL_PDD: 0,
        Estado: ""
      });
      setMl2Dados({});
      setPerfil("");
      setFraudeMessage("");
      alert("Erro ao consultar API.");
    } finally {
      setLoading(false);
    }
  };

  const getDotClass = (perfil) => {
    if (!perfil) return "";
    switch (perfil.toLowerCase()) {
      case "madura": return "madura";
      case "expansao": return "expansao";
      case "inicio": return "inicio";
      case "declinio": return "declinio";
      default: return "";
    }
  };

  // --------- Gráficos D3 ---------
  useEffect(() => {
    if (!empresaDados.VL_CAR) return;

    // Barra VL_CAR vs VL_PDD
    const barData = [
      { name: "VL_CAR", value: empresaDados.VL_CAR },
      { name: "VL_PDD", value: empresaDados.VL_PDD }
    ];

    d3.select(barRef.current).selectAll("*").remove();
    const width = 250, height = 150;
    const svg = d3.select(barRef.current).append("svg").attr("width", width).attr("height", height);

    const x = d3.scaleBand().domain(barData.map(d => d.name)).range([0, width]).padding(0.4);
    const y = d3.scaleLinear().domain([0, d3.max(barData, d => d.value)*1.2]).range([height-20, 0]);

    svg.selectAll(".bar")
       .data(barData)
       .enter()
       .append("rect")
       .attr("class", "bar")
       .attr("x", d => x(d.name))
       .attr("y", d => y(d.value))
       .attr("width", x.bandwidth())
       .attr("height", d => height-20 - y(d.value))
       .attr("fill", d => d.name === "VL_PDD" ? "#c9302c" : "#337ab7");

    svg.selectAll(".label")
       .data(barData)
       .enter()
       .append("text")
       .text(d => d.value.toLocaleString())
       .attr("x", d => x(d.name) + x.bandwidth()/2)
       .attr("y", d => y(d.value)-5)
       .attr("text-anchor", "middle")
       .attr("font-size", "12px");

    // Gauge Percentual PDD
    const percent = parseFloat(empresaDados.Percentual_PDD.toString().replace("%","")) || 0;
    d3.select(gaugeRef.current).selectAll("*").remove();
    const gWidth = 250, gHeight = 150;
    const gSvg = d3.select(gaugeRef.current).append("svg").attr("width", gWidth).attr("height", gHeight);

    const arc = d3.arc()
                  .innerRadius(40)
                  .outerRadius(70)
                  .startAngle(-Math.PI/2)
                  .endAngle(-Math.PI/2 + (Math.PI * percent/50));

    gSvg.append("path")
        .attr("d", arc)
        .attr("fill", percent > 10 ? "#c9302c" : "#5cb85c")
        .attr("transform", `translate(${gWidth/2},${gHeight-20})`);

    gSvg.append("text")
        .attr("x", gWidth/2)
        .attr("y", gHeight/2 + 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .text(`${percent}% PDD`);

    // Radar simples
    const radarData = [
      { axis: "Score", value: empresaDados.Score_cliente ? empresaDados.Score_cliente/1000 : 0.7 },
      { axis: "Risco", value: empresaDados.Faixa_risco === "Alto" ? 1 : empresaDados.Faixa_risco === "Medio" ? 0.6 : 0.3 },
      { axis: "PDD", value: percent/100 }
    ];

    const radarSize = 120;
    const radarSvg = d3.select(radarRef.current);
    radarSvg.selectAll("*").remove();
    const radarG = radarSvg.append("g").attr("transform", `translate(${radarSize},${radarSize})`);
    const angles = radarData.map((d,i) => (i/(radarData.length)) * 2*Math.PI - Math.PI/2);

    radarG.selectAll(".radar-line")
          .data(radarData)
          .enter()
          .append("line")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", (d,i) => radarSize*d.value*Math.cos(angles[i]))
          .attr("y2", (d,i) => radarSize*d.value*Math.sin(angles[i]))
          .attr("stroke", "#337ab7")
          .attr("stroke-width", 2);

    radarG.selectAll(".radar-label")
          .data(radarData)
          .enter()
          .append("text")
          .text(d => d.axis)
          .attr("x", (d,i) => radarSize*1.1*Math.cos(angles[i]))
          .attr("y", (d,i) => radarSize*1.1*Math.sin(angles[i]))
          .attr("text-anchor", "middle")
          .attr("font-size", "10px");

  }, [empresaDados]);

  // Mapa do Brasil
  useEffect(() => {
    if (!empresaDados.Estado) return;

    const geoUrl =
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

    d3.json(geoUrl).then(geoData => {
      d3.select(mapRef.current).selectAll("*").remove();

      const width = 500;
      const height = 400;
      const svg = d3.select(mapRef.current)
                    .append("svg")
                    .attr("width", width)
                    .attr("height", height);

      const projection = d3.geoMercator().fitSize([width, height], geoData);
      const path = d3.geoPath().projection(projection);

      svg.selectAll("path")
         .data(geoData.features)
         .enter()
         .append("path")
         .attr("d", path)
         .attr("fill", "transparent")
         .attr("stroke", "#c9302c")
         .attr("stroke-width", 1.5);

      const estadoDest = geoData.features.find(f => f.properties.sigla === empresaDados.Estado);
      if (estadoDest) {
        svg.append("path")
           .datum(estadoDest)
           .attr("d", path)
           .attr("fill", "#c9302c")
           .attr("stroke", "#c9302c")
           .attr("stroke-width", 2);

        const [x, y] = path.centroid(estadoDest);
        svg.append("text")
           .attr("x", x)
           .attr("y", y)
           .text(empresaDados.Estado)
           .attr("text-anchor", "middle")
           .attr("alignment-baseline", "middle")
           .attr("fill", "#fff")
           .attr("font-size", "14px")
           .attr("font-weight", "bold");
      }
    }).catch(err => console.error("Erro carregando GeoJSON:", err));
  }, [empresaDados.Estado]);

  return (
    <div className="risco-page">
      <aside className="sidebar">
        <CnpjWidget onResult={buscarPerfil} />

        {empresaDados.CNPJ && (
          <div className="empresa-detalhes">
            <h3>Dados da Empresa</h3>
            <p><strong>CNPJ:</strong> {empresaDados.CNPJ}</p>
            <p><strong>Razão Social:</strong> {empresaDados.razaoSocial}</p>
            <p><strong>Setor:</strong> {empresaDados.setor}</p>
            <p><strong>Perfil:</strong> {perfil}</p>
          </div>
        )}
      </aside>

      <main className="main-content">
        <h1 className="main-title">Análise de Risco</h1>
        {loading && <Loading message="Carregando dados..." />}

        <div className="risk-indicators">
          <div className="indicator-card">
            <h3>Valor em Aberto</h3>
            <p>R$ {empresaDados.VL_CAR.toLocaleString()}</p>
          </div>
          <div className="indicator-card">
            <h3>Score do Cliente</h3>
            <p>{empresaDados.Score_cliente || "-"}</p>
          </div>
          <div className="indicator-card">
            <h3>Faixa de Risco</h3>
            <p>{empresaDados.Faixa_risco || "-"}</p>
          </div>
          <div className="indicator-card">
            <h3>Valor PDD</h3>
            <p>R$ {empresaDados.VL_PDD.toLocaleString()}</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card chart-card">
            <h2>Gráficos</h2>
            <div ref={barRef}></div>
            <div ref={gaugeRef} style={{ marginTop: "20px" }}></div>
            <svg ref={radarRef} width={250} height={250} style={{ marginTop: "20px" }}></svg>
          </div>

          <div className="card map-card">
            <h2>Localização da Empresa</h2>
            <div style={{ width: "100%", height: "400px" }} ref={mapRef}></div>
          </div>
        </div>
      </main>

      <ModalFraude message={fraudeMessage} onClose={() => setFraudeMessage("")} />
    </div>
  );
}

export default Risco;
