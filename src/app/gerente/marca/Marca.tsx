"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Printer, Upload } from "lucide-react";
import { LogoRestaurante } from "@/components/Marca";
import { QrCode } from "@/components/QrCode";
import { Alerta, Botao, Campo, Cartao } from "@/components/ui";
import { COR_PRIMARIA, contraste, corPassaAA, hexValido } from "@/lib/cor";
import { formatarBRL } from "@/lib/formato";

const useOrigem = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

export function Marca({ nome, cor, logoUrl, slug, precoKg }: { nome: string; cor: string; logoUrl: string | null; slug: string; precoKg: number }) {
  const router = useRouter();
  const [nomeAtual, setNome] = useState(nome);
  const [corAtual, setCor] = useState(cor.toUpperCase());
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "atencao"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const base = useOrigem();

  const valida = hexValido(corAtual);
  const passa = valida && corPassaAA(corAtual);
  const razao = valida ? contraste(corAtual, "#FFFFFF") : 0;
  const corPreview = passa ? corAtual : COR_PRIMARIA;
  const urlEntrada = `${base}/entrar?loja=${slug}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    const r = await fetch("/api/gerente/restaurante", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeAtual, cor_destaque: corAtual }),
    });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: j.erro });
    if (j.aviso) {
      setCor(COR_PRIMARIA);
      setMsg({ tipo: "atencao", texto: j.aviso });
    } else setMsg({ tipo: "ok", texto: "Marca atualizada." });
    router.refresh();
  }

  async function enviarLogo(arquivo: File) {
    setEnviandoLogo(true);
    const form = new FormData();
    form.append("arquivo", arquivo);
    const r = await fetch("/api/gerente/logo", { method: "POST", body: form });
    const j = await r.json();
    setEnviandoLogo(false);
    setMsg(r.ok ? { tipo: "ok", texto: "Logo atualizado." } : { tipo: "erro", texto: j.erro });
    if (r.ok) router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Cartao>
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <Campo rotulo="Nome do restaurante" value={nomeAtual} onChange={(e) => setNome(e.target.value)} required />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Cor de destaque</span>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Escolher cor"
                  value={valida ? corAtual : "#000000"}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  className="h-12 w-16 cursor-pointer rounded-botao border border-borda bg-superficie p-1"
                />
                <input
                  aria-label="Cor em hexadecimal"
                  value={corAtual}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  maxLength={7}
                  className="num min-h-12 flex-1 rounded-botao border border-borda bg-superficie px-4 font-semibold uppercase"
                />
              </div>
              <p className={`flex items-center gap-1.5 text-sm font-medium ${passa ? "text-ok-texto" : "text-atencao-texto"}`}>
                {passa ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
                {valida
                  ? `Contraste com texto branco: ${razao.toFixed(2).replace(".", ",")}:1 ${passa ? "(passa no WCAG AA)" : "(abaixo de 4,5:1, será usada a cor padrão)"}`
                  : "Use o formato #RRGGBB"}
              </p>
              <p className="text-xs text-texto-2">
                A cor aparece só na tela de boas-vindas e numa faixa fina no topo da comanda. Botões, pagamento e status seguem as cores do Pague pelo App.
              </p>
            </div>
            {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
            <Botao type="submit" carregando={ocupado}>Salvar</Botao>
          </form>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-lg font-bold">Logo</h2>
          <div className="flex items-center gap-4">
            <LogoRestaurante nome={nomeAtual} logoUrl={logoUrl} cor={corPreview} className="size-20 border border-borda text-xl" />
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-botao border border-borda bg-superficie px-4 font-semibold hover:bg-superficie-2">
              <Upload className="size-5" aria-hidden /> {enviandoLogo ? "Enviando..." : "Enviar imagem"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && enviarLogo(e.target.files[0])}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-texto-2">PNG, JPG, WEBP ou SVG, até 1 MB. Prefira imagem quadrada.</p>
        </Cartao>
      </div>

      <div className="flex flex-col gap-5">
        <Cartao className="overflow-hidden p-0">
          <p className="px-5 pt-4 text-sm font-medium text-texto-2">Prévia da tela de boas-vindas</p>
          <div className="linhas-decorativas m-4 rounded-[24px] p-6 text-white" style={{ backgroundColor: corPreview }}>
            <LogoRestaurante nome={nomeAtual} logoUrl={logoUrl} cor="rgb(255 255 255 / 0.2)" className="size-14" />
            <p className="mt-4 opacity-90">Bem-vindo ao</p>
            <p className="text-2xl font-bold">{nomeAtual || "Seu restaurante"}</p>
            <p className="num opacity-95">Comida a quilo · {formatarBRL(precoKg)}/kg</p>
          </div>
        </Cartao>

        <Cartao className="flex flex-col items-center gap-3 text-center print:shadow-none" >
          <h2 className="text-lg font-bold">QR Code da entrada</h2>
          <p className="text-sm text-texto-2">Imprima e cole na porta. Ele abre o app já no seu restaurante.</p>
          {base && <QrCode valor={urlEntrada} tamanho={220} rotulo={`QR Code de entrada do ${nomeAtual}`} className="border border-borda" />}
          <p className="num break-all text-xs text-texto-2">{urlEntrada}</p>
          <Botao variante="secundario" onClick={() => window.print()}>
            <Printer className="size-5" aria-hidden /> Imprimir
          </Botao>
        </Cartao>
      </div>
    </div>
  );
}
