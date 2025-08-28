import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login/loginPage.jsx";
import Risco from "./pages/risco/risco.jsx";
import Comercial from "./pages/comercial/comercial.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/risco" element={<Risco />} />
        <Route path="/comercial" element={<Comercial />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
