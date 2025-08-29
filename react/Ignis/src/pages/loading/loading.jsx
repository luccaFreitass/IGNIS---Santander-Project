import React from "react";
import "./loading.css";


function Loading({ message }) {
  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{message || "Carregando..."}</p>
      </div>
    </div>
  );
}

export default Loading;
