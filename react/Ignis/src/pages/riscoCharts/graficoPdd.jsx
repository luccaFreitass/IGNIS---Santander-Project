import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

function GraficoPdd({ vlCar, vlPdd }) {
  const ref = useRef();

  useEffect(() => {
    const data = [
      { tipo: "VL_CAR", valor: vlCar },
      { tipo: "VL_PDD", valor: vlPdd }
    ];

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 80 };

    d3.select(ref.current).selectAll("*").remove();

    const svg = d3
      .select(ref.current)
      .attr("width", width)
      .attr("height", height);

    const x = d3
      .scaleBand()
      .domain(data.map(d => d.tipo))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.valor) * 1.2])
      .range([height - margin.bottom, margin.top]);

    // Eixo X
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", "#d9d9d9")
      .style("font-size", "12px");

    // Eixo Y
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("fill", "#d9d9d9")
      .style("font-size", "12px");

    // Empilhamento (stacked)
    const stack = d3.stack().keys(["valor"]);
    const series = stack([ { VL_CAR: vlCar, VL_PDD: vlPdd } ]);

    // Barras
    const bars = svg
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", d => x(d.tipo))
      .attr("y", y(0))
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", d => (d.tipo === "VL_PDD" ? "#c9302c" : "#08a7cf"));

    // Animação de subida
    bars
      .transition()
      .duration(800)
      .attr("y", d => y(d.valor))
      .attr("height", d => y(0) - y(d.valor));

    // Rótulos
    svg
      .selectAll(".label")
      .data(data)
      .join("text")
      .attr("x", d => x(d.tipo) + x.bandwidth() / 2)
      .attr("y", d => y(d.valor) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "12px")
      .text(d => d3.format(",")(d.valor));

  }, [vlCar, vlPdd]);

  return <svg ref={ref}></svg>;
}

export default GraficoPdd;
