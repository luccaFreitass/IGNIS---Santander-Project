import React from "react";
import "./modalFraude.css";

function ModalFraude({ message, onClose }) {
  if (!message) return null; // não renderiza nada se não tiver mensagem

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Fraude Detectada</h2>
        <p>{message}</p>
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default ModalFraude;
