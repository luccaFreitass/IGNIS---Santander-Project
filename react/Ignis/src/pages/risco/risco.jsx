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
  const mapRef = useRef();
  const networkRef = useRef();

  // Redireciona se não for usuário de risco
  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    if (userType !== "risco") navigate("/");
  }, [navigate]);

  // Função para buscar perfil pelo CNPJ
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

      setFraudeMessage(
        data.ML1?.alertas && data.ML1.alertas !== "nan"
          ? data.ML1.alertas
          : ""
      );

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

// Gráfico de rede (rede de parceiros)
useEffect(() => {
  if (!ml2Dados.principais_parceiros || ml2Dados.principais_parceiros.length === 0) return;

  const width = 500;
  const height = 400;
  d3.select(networkRef.current).selectAll("*").remove();

  const svg = d3.select(networkRef.current)
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .style("background", "rgba(30,30,30,0)")
                .style("border-radius", "12px");

  // Tooltip
  const tooltip = d3.select(networkRef.current)
    .append("div")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  const nodes = [
    { id: empresaDados.CNPJ, central: true },
    ...ml2Dados.principais_parceiros.map(p => ({
      id: p.cnpj,
      peso: p.peso,
      classificacao: p.classificacao // "Crítico", "Importante" ou "Secundário"
    }))
  ];

  const links = ml2Dados.principais_parceiros.map(p => ({
    source: empresaDados.CNPJ,
    target: p.cnpj,
    weight: p.peso
  }));

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(90))
    .force("charge", d3.forceManyBody().strength(-250))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = svg.append("g")
    .attr("stroke", "#b957577a")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.sqrt(d.weight) / 5)
    .attr("opacity", 0.7);

  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.central ? 16 : 10)
    .attr("fill", d => {
      if (d.central) return "#2cc4c9ff";
      if (d.classificacao === "Crítico") return "#ff4d4d";     // vermelho forte
      if (d.classificacao === "Importante") return "#ffae42";  // laranja
      if (d.classificacao === "Secundário") return "#4caf50";  // verde
      return "#999";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .call(drag(simulation))
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 1);
      tooltip.html(`<strong>${d.id}</strong><br>Peso: ${d.peso || "-"}<br>Classificação: ${d.classificacao || "-"}`)
             .style("left", event.pageX + 10 + "px")
             .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

  const label = svg.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.id)
    .attr("font-size", "10px")
    .attr("fill", "#fff")
    .attr("text-anchor", "middle")
    .attr("dy", -16);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    label
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });

  function drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
}, [ml2Dados, empresaDados.CNPJ]);


  // Mapa destacando o estado
  useEffect(() => {
    if (!empresaDados.Estado) return;

    const geoUrl = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

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

      // Todos os estados
      svg.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "transparent")
        .attr("stroke", "#c9302c")
        .attr("stroke-width", 1.5);

      // Destaca o estado
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

  // JSX
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

        {ml2Dados && ml2Dados.principais_parceiros && (
          <div className="card network-card">
            <h2>Rede de Parceiros</h2>
            <div ref={networkRef} style={{ width: "100%", height: "400px", position: "relative" }}></div>
          </div>
        )}

        <div className="card map-card">
          <h2>Localização da Empresa</h2>
          <div ref={mapRef} style={{ width: "100%", height: "400px", position: "relative", overflow: "visible" }}></div>
        </div>
      </main>

      <ModalFraude message={fraudeMessage} onClose={() => setFraudeMessage("")} />
    </div>
  );
}

export default Risco;
