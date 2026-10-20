import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Tests } from "./Tests";
import "../styles.css";
import "./tests.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Tests />
  </StrictMode>,
);
