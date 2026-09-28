"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, CreditCard, FlaskConical, QrCode as IconeQr } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { Alerta, Botao, Campo, Cartao, Carregando, cx } from "@/components/ui";
import { formatarBRL } from "@/lib/formato";
import type { Pagamento as TPagamento } from "@/lib/tipos";
import { useComandaAoVivo } from "@/lib/useComandaAoVivo";

type Metodo = "pix" | "cartao";

export function Pagamento({ comandaId, restaurante }: { comandaId: string; restaurante: string }) {
  const router = useRouter();
  const { comanda, carregando } = useComandaAoVivo(comandaId);
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [pix, setPix] = useState<TPagamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (carregando || !comanda) return <Carregando />;
  const saldo = Math.round((Number(comanda.total) - Number(comanda.total_pago)) * 100) / 100;
  const valorMudou = pix && Number(pix.valor) !== saldo;

  async function chamar(url: string, corpo?: unknown) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Falha no pagamento.");
      return j;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Sem conexão. Tente de novo.");
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function gerarPix() {
    const j = await chamar("/api/pagamentos", { metodo: "pix" });
    if (j) setPix(j.pagamento);
  }

  async function simularAprovacao() {
    if (!pix) return;
    const j = await chamar(`/api/pagamentos/${pix.id}/simular`);
    if (j) router.push(`/app/comprovante/${pix.id}`);
    else setPix(null);
  }

  async function pagarCartao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const j = await chamar("/api/pagamentos", {
      metodo: "cartao",
      cartao: {
        numero: String(f.get("numero")),
        nome: String(f.get("nome")),
        validade: String(f.get("validade")),
        cvv: String(f.get("cvv")),
      },
    });
    if (j) router.push(`/app/comprovante/${j.pagamentoId}`);
  }

  async function copiar() {
    if (!pix?.pix_copia_e_cola) return;
    await navigator.clipboard.writeText(pix.pix_copia_e_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center gap-3">
        <Link href="/app/comanda" aria-label="Voltar" className="grid size-12 place-items-center rounded-full border border-borda bg-superficie">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-sm text-texto-2">{restaurante} · comanda {comanda.codigo_curto}</p>
          <h1 className="text-xl font-bold">Pagamento</h1>
        </div>
      </header>

      <section className="linhas-decorativas rounded-[28px] bg-marca p-5 text-marca-texto shadow-cartao">
        <p className="text-sm opacity-90">{Number(comanda.total_pago) > 0 ? "Diferença a pagar" : "Valor a pagar"}</p>
        <p className="num text-4xl font-bold">{formatarBRL(Math.max(saldo, 0))}</p>
        {Number(comanda.total_pago) > 0 && (
          <p className="num mt-1 text-sm opacity-90">
            Total {formatarBRL(comanda.total)} · já pago {formatarBRL(comanda.total_pago)}
          </p>
        )}
      </section>

      {comanda.status !== "PENDENTE_PAGAMENTO" ? (
        <Cartao className="text-center">
          <p className="font-semibold">{comanda.status === "PAGA" ? "Comanda paga!" : "Não há saldo a pagar agora."}</p>
          {comanda.status === "PAGA" && (
            <Link href="/app/saida" className="mt-3 inline-block font-semibold text-marca hover:underline">
              Ver Passe de Saída
            </Link>
          )}
        </Cartao>
      ) : (
        <>
          <div role="tablist" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2 rounded-[18px] bg-superficie-2 p-1.5">
            {(
              [
                ["pix", "Pix", IconeQr],
                ["cartao", "Cartão", CreditCard],
              ] as const
            ).map(([valor, rotulo, Icone]) => (
              <button
                key={valor}
                role="tab"
                aria-selected={metodo === valor}
                onClick={() => {
                  setMetodo(valor);
                  setErro(null);
                }}
                className={cx(
                  "flex min-h-12 items-center justify-center gap-2 rounded-[14px] font-semibold transition",
                  metodo === valor ? "bg-superficie text-marca shadow-sm" : "text-texto-2",
                )}
              >
                <Icone className="size-5" aria-hidden /> {rotulo}
              </button>
            ))}
          </div>

          <Alerta tipo="info">
            <span className="inline-flex items-center gap-1.5">
              <FlaskConical className="size-4" aria-hidden /> Ambiente de demonstração: nenhum valor real é cobrado.
            </span>
          </Alerta>

          {erro && <Alerta>{erro}</Alerta>}

          {metodo === "pix" ? (
            <Cartao className="flex flex-col items-center gap-4 text-center">
              {!pix ? (
                <>
                  <p className="text-texto-2">Gere o Pix e pague pelo app do seu banco.</p>
                  <Botao grande className="w-full" onClick={gerarPix} carregando={ocupado}>
                    Gerar Pix de {formatarBRL(saldo)}
                  </Botao>
                </>
              ) : (
                <>
                  {valorMudou && (
                    <Alerta tipo="atencao">
                      O valor da comanda mudou. Gere um novo Pix de {formatarBRL(saldo)}.
                    </Alerta>
                  )}
                  <QrCode valor={pix.pix_copia_e_cola ?? ""} tamanho={220} rotulo="QR Code Pix fictício" className="border border-borda" />
                  <p className="num text-2xl font-bold">{formatarBRL(pix.valor)}</p>
                  <Botao variante="secundario" className="w-full" onClick={copiar}>
                    {copiado ? <Check className="size-5 text-ok-texto" /> : <Copy className="size-5" />}
                    {copiado ? "Copiado!" : "Copiar código Pix"}
                  </Botao>
                  {valorMudou ? (
                    <Botao grande className="w-full" onClick={gerarPix} carregando={ocupado}>
                      Gerar novo Pix
                    </Botao>
                  ) : (
                    <Botao grande className="w-full" onClick={simularAprovacao} carregando={ocupado}>
                      Simular pagamento aprovado
                    </Botao>
                  )}
                </>
              )}
            </Cartao>
          ) : (
            <Cartao>
              <form onSubmit={pagarCartao} className="flex flex-col gap-3">
                <Campo rotulo="Número do cartão" name="numero" inputMode="numeric" autoComplete="off" placeholder="4111 1111 1111 1111" required
                  ajuda="Teste: final 0002 = recusado; final 0003 = saldo insuficiente; outros = aprovado." />
                <Campo rotulo="Nome impresso" name="nome" autoComplete="off" placeholder="COMO NO CARTÃO" required />
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Validade" name="validade" placeholder="MM/AA" inputMode="numeric" autoComplete="off" required pattern="\d{2}/\d{2}" />
                  <Campo rotulo="CVV" name="cvv" placeholder="123" inputMode="numeric" autoComplete="off" required pattern="\d{3,4}" />
                </div>
                <Botao grande type="submit" carregando={ocupado} className="mt-2">
                  Pagar {formatarBRL(saldo)}
                </Botao>
              </form>
            </Cartao>
          )}
        </>
      )}
    </main>
  );
}
