import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const SITE_TITLE = "Pausa — pinta despacio";
const SITE_DESCRIPTION =
  "Un juego cozy de pintura pensado para relajarte, nivel a nivel.";

function requestOrigin(requestHeaders: Awaited<ReturnType<typeof headers>>) {
  const forwardedHost = requestHeaders
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();
  const host = forwardedHost || requestHeaders.get("host") || "localhost:3000";
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";

  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin(await headers());
  const socialImage = new URL("/og.png", origin);

  return {
    metadataBase: origin,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      locale: "es_ES",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "Pausa, un juego relajante de pintura",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
