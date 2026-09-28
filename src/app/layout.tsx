import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AvisoConexao } from "@/components/AvisoConexao";
import { RegistrarSW } from "@/components/RegistrarSW";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Pague pelo App", template: "%s · Pague pelo App" },
  description: "Comanda digital, pagamento pelo celular e saída sem fila para restaurantes a quilo.",
  applicationName: "Pague pelo App",
  appleWebApp: { capable: true, title: "Pague pelo App", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AvisoConexao />
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
