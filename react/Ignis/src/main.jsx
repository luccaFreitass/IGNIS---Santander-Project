import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login/loginPage.jsx";
import Cnpj from "./pages/consultaCnpj/cnpjPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cnpj" element={<Cnpj />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
