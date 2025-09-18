"use client"

import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import * as d3 from "d3"
import CnpjWidget from "../consultaCnpj/cnpjWidget.jsx"
import Loading from "../loading/loading.jsx"
import "./comercialPage.css"

function Comercial() {
  const navigate = useNavigate()
  const [empresaDados, setEmpresaDados] = useState({
    CNPJ: "",
    VL_CAR: 0,
    VL_SLDO: 0,
    Faixa_risco: "",
    Estado: "",
    razaoSocial: "-",
    setor: "-",
    perfil: "-", // se quiser, ou pode gerar dinamicamente depois
  })
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState("")
  const mapRef = useRef()

  // Redireciona se não for usuário comercial
  useEffect(() => {
    const userType = sessionStorage.getItem("userType")
    if (userType !== "comercial") navigate("/")
  }, [navigate])

  // Função para buscar dados pelo CNPJ
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
        VL_CAR: data.ML1?.VL_CAR || 0,
        VL_SLDO: data.ML1?.VL_SLDO || 0,
        Faixa_risco: data.ML1?.Faixa_risco || "-",
        Estado: data.ML1?.Estado || "",
        razaoSocial: data.ML1?.razaoSocial || "-",
        setor: data.ML1?.setor || "-",
        perfil: data.ML1?.perfil_predito || "-", // se quiser mostrar
      })

      // Aqui você pode gerar insights com base nos dados
      setInsights(
        `Empresa com risco ${data.ML1?.Faixa_risco || "-"} e valor em aberto de R$ ${(
          data.ML1?.VL_CAR || 0
        ).toLocaleString("pt-BR")}.`,
      )
    } catch (err) {
      console.error(err)
      setEmpresaDados({
        CNPJ: "",
        VL_CAR: 0,
        Faixa_risco: "",
        Estado: "",
      })
      setInsights("")
      alert("Erro ao consultar API.")
    } finally {
      setLoading(false)
    }
  }

  // Desenhar mapa da localização
  useEffect(() => {
    if (!empresaDados.Estado) return

    const geoUrl =
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"

    d3.json(geoUrl)
      .then((geoData) => {
        d3.select(mapRef.current).selectAll("*").remove()

        const width = 400
        const height = 250

        const svg = d3.select(mapRef.current).append("svg").attr("width", width).attr("height", height)

        const projection = d3.geoMercator().fitSize([width, height], geoData)
        const path = d3.geoPath().projection(projection)

        // Todos os estados
        svg
          .selectAll("path")
          .data(geoData.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", "transparent")
          .attr("stroke", "#dc2626")
          .attr("stroke-width", 1.5)

        // Destaca o estado
        const estadoDest = geoData.features.find((f) => f.properties.sigla === empresaDados.Estado)
        if (estadoDest) {
          svg
            .append("path")
            .datum(estadoDest)
            .attr("d", path)
            .attr("fill", "#dc2626")
            .attr("stroke", "#dc2626")
            .attr("stroke-width", 2)

          const [x, y] = path.centroid(estadoDest)
          svg
            .append("text")
            .attr("x", x)
            .attr("y", y)
            .text(empresaDados.Estado)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("fill", "#fff")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
        }
      })
      .catch((err) => console.error("Erro carregando GeoJSON:", err))
  }, [empresaDados.Estado])

  return (
    <div className="comercial-page">
      <div className="comercial-container">
        <aside className="sidebar">
          <div className="sidebar-content">
            <h2 className="sidebar-title">Consulta CNPJ</h2>
            <CnpjWidget onResult={buscarPerfil} />
          </div>
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
                <strong>Perfil:</strong> {empresaDados.perfil}
              </p>
            </div>
          )}
        </aside>

        <main className="main-content">
          <header className="page-header">
            <h1 className="page-title">Dashboard Comercial</h1>
            <p className="page-subtitle">Análise completa de perfil empresarial</p>
          </header>

          {loading && (
            <div className="loading-overlay">
              <Loading message="Carregando dados..." />
            </div>
          )}

          <section className="metrics-section">
            <div className="metrics-grid">
              <div className="metric-card saldo-card">
    <div className="metric-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="6" width="20" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </div>
    <div className="metric-content">
      <h3 className="metric-label">Saldo em Conta</h3>
      <p className="metric-value">R$ {empresaDados.VL_SLDO.toLocaleString("pt-BR")}</p>
    </div>
  </div>

              <div className="metric-card value-card">
                <div className="metric-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="metric-content">
                  <h3 className="metric-label">Valor em Aberto</h3>
                  <p className="metric-value">R$ {empresaDados.VL_CAR.toLocaleString("pt-BR")}</p>
                </div>
              </div>

              <div className="metric-card risk-card">
                <div className="metric-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10.29 3.86L1.82 18A2 2 0 0 0 3.54 21H20.46A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="12"
                      y1="9"
                      x2="12"
                      y2="13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="12"
                      y1="17"
                      x2="12.01"
                      y2="17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="metric-content">
                  <h3 className="metric-label">Faixa de Risco</h3>
                  <p className="metric-value">{empresaDados.Faixa_risco || "-"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="visualization-section">
            <div className="chart-card">
              <div className="chart-header">
                <h2 className="chart-title">Localização da Empresa</h2>
                <p className="chart-subtitle">Distribuição geográfica no território nacional</p>
              </div>
              <div className="chart-content">
                <div ref={mapRef} className="map-container"></div>
              </div>
            </div>
          </section>

          <section className="insights-section">
            <div className="insights-grid">
              <div className="insights-card">
                <h2 className="insights-title">Insights Comerciais</h2>
                <div className="insights-content">
                  <p className="insights-text">
                    {insights ||
                      "Consulte um CNPJ para visualizar insights detalhados sobre o perfil de risco e oportunidades comerciais."}
                  </p>
                </div>
              </div>

              <div className="recommendations-card">
                <h2 className="recommendations-title">Recomendações</h2>
                <div className="recommendations-content">
                  <p className="recommendations-text">
                    {empresaDados.CNPJ
                      ? "Com base no perfil analisado, recomendamos produtos adequados ao nível de risco identificado."
                      : "Após a consulta, apresentaremos recomendações personalizadas de produtos e estratégias comerciais."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Comercial
