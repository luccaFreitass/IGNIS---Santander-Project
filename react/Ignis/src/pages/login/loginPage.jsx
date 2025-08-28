import React, { useState } from "react";
import { useNavigate } from "react-router-dom";  // Importa navigate
import "./loginPage.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();  // Inicializa o navigate

  // Usuários de exemplo
  const users = {
    risco: "senha123",
    comercial: "senha456",
  };

  function handleLogin() {
    setErrorMsg("");

    if (!username.trim() || !password) {
      setErrorMsg("Preencha usuário e senha.");
      return;
    }

    if (users[username] && users[username] === password) {
      sessionStorage.setItem("userType", username);

      // Direciona de acordo com o tipo de usuário
      if (username === "risco") {
        navigate("/risco");
      } else if (username === "comercial") {
        navigate("/comercial");
      }
    } else {
      setErrorMsg("Usuário ou senha inválidos.");
    }
  }

  return (
    <div className="login-page">
      <div className="left-column">
        <img
          src="./src/images/santander-logo.png"
          alt="Santander"
          className="logo"
        />
        <header className="login-header">
          <h2>Sistema de Perfis PJ</h2>
        </header>
        <main className="main-login">
          <div className="login-container">
            <div className="error">{errorMsg}</div>
            <div className="usuario">
              <label htmlFor="username">Usuário</label>
              <input
                type="text"
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
              />
            </div>
            <div className="senha">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>
            <button id="loginBtn" onClick={handleLogin}>
              Entrar
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Login;
