import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import PainterGame from "../app/painter-game";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PainterGame />
  </StrictMode>,
);
