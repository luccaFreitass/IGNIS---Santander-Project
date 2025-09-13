"use client"

import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import * as d3 from "d3"
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts"
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx"
import Loading from "../loading/loading.jsx"
import ModalFraude from "../modalFraude/modalFraude.jsx"
import "./riscoPage.css"

function Risco() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState("")
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
    Estado: "",
  })
  const [ml2Dados, setMl2Dados] = useState({})
  const [loading, setLoading] = useState(false)
  const [fraudeMessage, setFraudeMessage] = useState("")
  const mapRef = useRef()
  const networkRef = useRef()

  // Redireciona se não for usuário de risco
  useEffect(() => {
    const userType = sessionStorage.getItem("userType")
    if (userType !== "risco") navigate("/")
  }, [navigate])

  // Função para buscar perfil pelo CNPJ
  const buscarPerfil = async (cnpj) => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cnpj.trim().toUpperCase() }),
      })

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`)
      const data = await response.json()

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
        Estado: data.ML1?.Estado || "",
      })

      setMl2Dados(data.ML2 || {})
      setPerfil(data.ML1?.perfil_predito || "-")

      setFraudeMessage(data.ML1?.alertas && data.ML1.alertas !== "nan" ? data.ML1.alertas : "")
    } catch (err) {
      console.error(err)
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
        Estado: "",
      })
      setMl2Dados({})
      setPerfil("")
      setFraudeMessage("")
      alert("Erro ao consultar API.")
    } finally {
      setLoading(false)
    }
  }

  // ---------------------- Dados para gráficos ----------------------
  const parceirosData = (ml2Dados.principais_parceiros || []).map((p) => ({
    name: p.cnpj,
    peso: p.peso,
    classificacao: p.classificacao,
  }))

  const classificacaoCounts = [
    { name: "Crítico", value: parceirosData.filter((p) => p.classificacao === "Crítico").length },
    { name: "Importante", value: parceirosData.filter((p) => p.classificacao === "Importante").length },
    { name: "Secundário", value: parceirosData.filter((p) => p.classificacao === "Secundário").length },
  ]

  const radarData = [
    { metric: "Faturamento", value: Math.min(empresaDados.VL_CAR / 1000, 100) },
    { metric: "Score", value: empresaDados.Score_cliente || 0 },
    { metric: "PDD", value: Math.min(empresaDados.VL_PDD / 1000, 100) },
    {
      metric: "Risco",
      value: empresaDados.Faixa_risco === "Alto" ? 80 : empresaDados.Faixa_risco === "Médio" ? 50 : 20,
    },
  ]

  const faturamentoLinha = [
    { mes: "Jan", valor: 200, meta: 180 },
    { mes: "Fev", valor: 350, meta: 320 },
    { mes: "Mar", valor: 400, meta: 380 },
    { mes: "Abr", valor: 600, meta: 550 },
    { mes: "Mai", valor: 800, meta: 750 },
    { mes: "Jun", valor: 950, meta: 900 },
  ]

  const COLORS = ["#dc2626", "#f97316", "#22c55e", "#3b82f6"]
  const GRADIENT_COLORS = ["#dc2626", "#b91c1c", "#991b1b"]

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }
// ---------------------- D3: Rede de parceiros ----------------------
useEffect(() => {
  if (!ml2Dados.principais_parceiros || ml2Dados.principais_parceiros.length === 0) return;

  const width = 360;
  const height = 260;
  d3.select(networkRef.current).selectAll("*").remove();

  const svg = d3.select(networkRef.current)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // ===== NODES =====
  const nodes = [
    { id: empresaDados.CNPJ, central: true },
    ...ml2Dados.principais_parceiros.map(p => ({
      id: p.cnpj,
      peso: p.peso,
      classificacao: p.classificacao
    }))
  ];

  // ===== LINKS =====
  const links = ml2Dados.principais_parceiros.map(p => ({
    source: empresaDados.CNPJ,
    target: p.cnpj,
    weight: p.peso
  }));

  // Garantir que links tenham objetos como source/target
  links.forEach(l => {
    if (typeof l.source === "string") {
      l.source = nodes.find(n => n.id === l.source);
    }
    if (typeof l.target === "string") {
      l.target = nodes.find(n => n.id === l.target);
    }
  });

  // ===== SIMULAÇÃO =====
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(90))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.central ? 26 : 18));

  // ===== LINKS =====
  const link = svg.append("g")
    .attr("stroke", "#b95757")
    .attr("stroke-opacity", 0.7)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.max(0.5, d.weight / 1000));

  // ===== NODES =====
  const node = svg.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => d.central ? 14 : Math.min(10 + d.peso / 20, 18))
    .attr("fill", d => {
      if (d.central) return "#2cc4c9";
      if (d.classificacao === "Crítico") return "#ff4d4d";
      if (d.classificacao === "Importante") return "#ffae42";
      if (d.classificacao === "Secundário") return "#4caf50";
      return "#999";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.2)
    .call(drag(simulation));

  // ===== LABELS =====
  const label = svg.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.central ? "EMPRESA" : d.id.slice(-4))
    .attr("font-size", "15px")
    .attr("fill", "#fff")
    .attr("text-anchor", "middle")
    .attr("dy", -16);

  // ===== TICK =====
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

  // ===== DRAG =====
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



  useEffect(() => {
    if (!empresaDados.Estado) return;

    const geoUrl = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

    d3.json(geoUrl).then(geoData => {
      d3.select(mapRef.current).selectAll("*").remove();

      const width = 400;
      const height = 250;

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

  // ---------------------- JSX ----------------------
  return (
    <div className="risco-page">
      <aside className="sidebar">
        <CnpjWidget onResult={buscarPerfil} />

        {empresaDados.CNPJ && (
          <div className="empresa-detalhes">
            <h3>Dados da Empresa</h3>
            <p>
              <strong>CNPJ:</strong> {empresaDados.CNPJ}
            </p>
            <p>
              <strong>Razão Social:</strong> {empresaDados.razaoSocial}
            </p>
            <p>
              <strong>Setor:</strong> {empresaDados.setor}
            </p>
            <p>
              <strong>Perfil:</strong> {perfil}
            </p>
          </div>
        )}
      </aside>

      <main className="main-content">
        <h1 className="main-title">Dashboard de Risco</h1>
        {loading && <Loading message="Carregando dados..." />}

        <div className="risk-indicators">
          <div className="indicator-card animate-slide-up">
            <div className="indicator-icon">💰</div>
            <h3>Valor em Aberto</h3>
            <p className="indicator-value">R$ {empresaDados.VL_CAR.toLocaleString()}</p>
          </div>
          <div className="indicator-card animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="indicator-icon">📊</div>
            <h3>Score</h3>
            <p className="indicator-value">{empresaDados.Score_cliente || "-"}</p>
          </div>
          <div className="indicator-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="indicator-icon">⚠️</div>
            <h3>Faixa de Risco</h3>
            <p className="indicator-value">{empresaDados.Faixa_risco || "-"}</p>
          </div>
          <div className="indicator-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="indicator-icon">📉</div>
            <h3>PDD</h3>
            <p className="indicator-value">R$ {empresaDados.VL_PDD.toLocaleString()}</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card chart-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="chart-header">
              <h2>Classificação dos Parceiros</h2>
              <div className="chart-stats">
                <span className="stat-label">Total de Parceiros</span>
                <span className="stat-number">{parceirosData.length}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={classificacaoCounts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={40}
                  paddingAngle={2}
                  animationBegin={0}
                  animationDuration={1200}
                >
                  {classificacaoCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#1f2937" strokeWidth={2} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card chart-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="chart-header">
              <h2>Top Parceiros por Peso</h2>
              <div className="chart-subtitle">Principais relacionamentos comerciais</div>
            </div>
            <div className="chart-stats">
                <span className="stat-label">Volume Total</span>
                <span className="stat-number">
                  R$ {ml2Dados.volume_total?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={parceirosData.slice(0, 5)} layout="vertical" margin={{ left: 60 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#b91c1c" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#9ca3af"
                  fontSize={10}
                  width={50}
                  tickFormatter={(value) => value.slice(-4)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="peso"
                  fill="url(#barGradient)"
                  radius={[0, 4, 4, 0]}
                  animationDuration={1200}
                  animationBegin={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card chart-card animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <div className="chart-header">
              <h2>Métricas da Empresa</h2>
              <div className="chart-subtitle">Análise multidimensional</div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid stroke="#374151" strokeOpacity={0.3} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Radar
                  dataKey="value"
                  stroke="#dc2626"
                  fill="#dc2626"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  animationDuration={1500}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="card chart-card animate-fade-in" style={{ animationDelay: "0.8s" }}>
            <div className="chart-header">
              <h2>Rede de Parceiros</h2>
              <div className="chart-subtitle">Mapeamento de relacionamentos</div>
            </div>
            <div className="network-container">
              <div ref={networkRef} style={{ width: "100%", height: "280px" }}></div>
            </div>
          </div>

          <div className="card chart-card map-card animate-fade-in" style={{ animationDelay: "1s" }}>
            <div className="chart-header">
              <h2>Localização da Empresa</h2>
              <div className="chart-subtitle">Distribuição geográfica</div>
            </div>
            <div className="map-container">
              <div ref={mapRef} style={{ width: "100%", height: "280px" }}></div>
            </div>
          </div>
        </div>
      </main>

      <ModalFraude message={fraudeMessage} onClose={() => setFraudeMessage("")} />
    </div>
  )
}

export default Risco
