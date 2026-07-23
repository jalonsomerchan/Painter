import type { Metadata } from "next";
import PainterGame from "./painter-game";

export const metadata: Metadata = {
  title: "Pausa — pinta despacio",
  description:
    "Un pequeño juego de pintura para desconectar, respirar y llenar de color cada rincón.",
};

export default function Home() {
  return <PainterGame />;
}
