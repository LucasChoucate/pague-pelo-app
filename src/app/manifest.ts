import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pague pelo App",
    short_name: "Pague pelo App",
    description: "Comanda digital, pagamento pelo celular e saída sem fila.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F766E",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
