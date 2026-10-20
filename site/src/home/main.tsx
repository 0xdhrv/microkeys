import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./Home";
import "../styles.css";
import "./home.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
