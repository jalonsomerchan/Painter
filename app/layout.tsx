import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pausa — pinta despacio",
  description:
    "Un juego cozy de pintura pensado para relajarte, nivel a nivel.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
