"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Keyboard, Pencil, ScanLine, Trash2, X } from "lucide-react";
import { ListaItens } from "@/components/ListaItens";
import { Scanner } from "@/components/Scanner";
import { Alerta, Botao, Cartao, Carregando, SeloStatus, cx } from "@/components/ui";
import { formatarBRL, formatarPeso } from "@/lib/formato";
import { supabaseNavegador } from "@/lib/supabase/client";
import type { ItemAvulso, ItemComanda } from "@/lib/tipos";
import { useComandaAoVivo } from "@/lib/useComandaAoVivo";

export function Caixa({ precoKg, avulsos }: { precoKg: number; avulsos: ItemAvulso[] }) {
  const [comandaId, setComandaId] = useState<string | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [modoManual, setModoManual] = useState(false);

  async function resolver(texto: string) {
    setBuscando(true);
    setErroBusca(null);
    try {
      const r = await fetch("/api/caixa/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setComandaId(j.comandaId);
    } catch (e) {
      setErroBusca(e instanceof Error && e.message ? e.message : "Sem conexão.");
    } finally {
      setBuscando(false);
    }
  }

  if (comandaId) {
    return <ComandaAberta key={comandaId} comandaId={comandaId} precoKg={precoKg} avulsos={avulsos} fechar={() => setComandaId(null)} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-superficie-2 p-1.5" role="tablist">
        {[
          [false, "Escanear comanda", ScanLine],
          [true, "Digitar código", Keyboard],
        ].map(([manual, rotulo, Icone]) => {
          const I = Icone as typeof ScanLine;
          return (
            <button
              key={String(manual)}
              role="tab"
              aria-selected={modoManual === manual}
              onClick={() => setModoManual(manual as boolean)}
              className={cx(
                "flex min-h-14 items-center justify-center gap-2 rounded-[14px] text-base font-semibold",
                modoManual === manual ? "bg-superficie text-marca shadow-sm" : "text-texto-2",
              )}
            >
              <I className="size-5" aria-hidden /> {rotulo as string}
            </button>
          );
        })}
      </div>

      {erroBusca && <Alerta>{erroBusca}</Alerta>}

      {modoManual ? (
        <Cartao>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolver(String(new FormData(e.currentTarget).get("codigo")));
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="codigo" className="text-sm font-medium">Código da comanda (4 caracteres)</label>
            <input
              id="codigo"
              name="codigo"
              autoFocus
              maxLength={4}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="A7K2"
              className="num min-h-16 rounded-botao border border-borda bg-superficie text-center text-4xl font-bold uppercase tracking-[0.4em] focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
            />
            <Botao grande type="submit" carregando={buscando}>Abrir comanda</Botao>
          </form>
        </Cartao>
      ) : (
        <Cartao className="p-3">
          <Scanner aoLer={resolver} pausado={buscando} />
          <p className="mt-3 text-center text-sm text-texto-2">Aponte a câmera para o QR da comanda no celular do cliente.</p>
        </Cartao>
      )}
    </main>
  );
}

function ComandaAberta({
  comandaId,
  precoKg,
  avulsos,
  fechar,
}: {
  comandaId: string;
  precoKg: number;
  avulsos: ItemAvulso[];
  fechar: () => void;
}) {
  const { comanda, itens, itensRemovidos, carregando, recarregar } = useComandaAoVivo(comandaId);
  const [cliente, setCliente] = useState<string>("");
  const [peso, setPeso] = useState("");
  const [unidade, setUnidade] = useState<"g" | "kg">("g");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<{ item: ItemComanda; modo: "corrigir" | "remover" } | null>(null);

  useEffect(() => {
    if (!comanda) return;
    supabaseNavegador()
      .from("usuarios")
      .select("nome")
      .eq("id", comanda.cliente_id)
      .single()
      .then(({ data }: { data: { nome: string } | null }) => setCliente(data?.nome ?? "Cliente"));
  }, [comanda?.cliente_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  const emojis = Object.fromEntries(avulsos.map((a) => [a.id, a.emoji]));
  const gramas = (() => {
    const n = Number(peso.replace(",", "."));
    if (!(n > 0)) return 0;
    return Math.round(unidade === "kg" ? n * 1000 : n);
  })();

  async function rpc(nome: string, args: Record<string, unknown>, sucesso: string) {
    setOcupado(true);
    const { error } = await supabaseNavegador().rpc(nome, args);
    setOcupado(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return false;
    }
    setMsg({ tipo: "ok", texto: sucesso });
    recarregar();
    return true;
  }

  async function lancarPeso(e: FormEvent) {
    e.preventDefault();
    if (!gramas) return;
    const ok = await rpc("lancar_pesagem", { p_comanda: comandaId, p_peso_g: gramas }, `Pesagem de ${formatarPeso(gramas)} lançada.`);
    if (ok) setPeso("");
  }

  if (carregando || !comanda) return <Carregando texto="Abrindo comanda..." />;
  const encerrada = !["ABERTA", "PENDENTE_PAGAMENTO", "PAGA"].includes(comanda.status);
  const saldo = Number(comanda.total) - Number(comanda.total_pago);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_1.1fr]">
      {/* Coluna da comanda */}
      <section className="flex flex-col gap-4">
        <Cartao>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-texto-2">Comanda</p>
              <p className="num text-3xl font-bold tracking-widest">{comanda.codigo_curto}</p>
              <p className="truncate text-lg font-semibold">{cliente}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <SeloStatus status={comanda.status} />
              <Botao variante="secundario" onClick={fechar} className="min-h-12">
                <X className="size-5" aria-hidden /> Próximo cliente
              </Botao>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-borda pt-4">
            <div>
              <p className="text-sm text-texto-2">Total</p>
              <p className="num text-4xl font-bold">{formatarBRL(comanda.total)}</p>
            </div>
            {Number(comanda.total_pago) > 0 && (
              <div className="text-right text-sm">
                <p className="num text-texto-2">Pago {formatarBRL(comanda.total_pago)}</p>
                {saldo > 0 && <p className="num font-semibold text-atencao-texto">Falta {formatarBRL(saldo)}</p>}
              </div>
            )}
          </div>
        </Cartao>

        {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
        {encerrada && <Alerta tipo="atencao">Esta comanda está encerrada e não aceita lançamentos.</Alerta>}

        <Cartao>
          <h2 className="mb-3 text-lg font-bold">Itens ({itens.length})</h2>
          {itens.length === 0 ? (
            <p className="rounded-[18px] bg-superficie-2 p-4 text-center text-texto-2">Nenhum item lançado.</p>
          ) : (
            <ListaItens
              itens={itens}
              emojis={emojis}
              acao={(item) =>
                !encerrada && (
                  <div className="flex gap-1">
                    <button
                      aria-label={`Corrigir ${item.descricao}`}
                      onClick={() => setEditando({ item, modo: "corrigir" })}
                      className="grid size-12 place-items-center rounded-full text-texto-2 hover:bg-superficie"
                    >
                      <Pencil className="size-5" />
                    </button>
                    <button
                      aria-label={`Remover ${item.descricao}`}
                      onClick={() => setEditando({ item, modo: "remover" })}
                      className="grid size-12 place-items-center rounded-full text-erro-texto hover:bg-superficie"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                )
              }
            />
          )}
          {itensRemovidos.length > 0 && (
            <details className="mt-3 text-sm text-texto-2">
              <summary className="cursor-pointer">{itensRemovidos.length} item(ns) removido(s)</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {itensRemovidos.map((i) => (
                  <li key={i.id} className="num line-through">
                    {i.descricao} · {formatarBRL(i.valor)} {i.motivo_remocao && `(${i.motivo_remocao})`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Cartao>

        {editando && (
          <EditarItem
            key={editando.item.id + editando.modo}
            {...editando}
            ocupado={ocupado}
            cancelar={() => setEditando(null)}
            confirmar={async (valor) => {
              const { item, modo } = editando;
              const ok =
                modo === "remover"
                  ? await rpc("remover_item", { p_item: item.id, p_motivo: valor }, "Item removido.")
                  : await rpc(
                      "corrigir_item",
                      item.tipo === "pesagem" ? { p_item: item.id, p_peso_g: Number(valor) } : { p_item: item.id, p_quantidade: Number(valor) },
                      "Item corrigido.",
                    );
              if (ok) setEditando(null);
            }}
          />
        )}
      </section>

      {/* Coluna de lançamento */}
      <section className={cx("flex flex-col gap-4", encerrada && "pointer-events-none opacity-50")}>
        <Cartao>
          <form onSubmit={lancarPeso} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Pesagem</h2>
              <span className="num text-sm text-texto-2">{formatarBRL(precoKg)}/kg</span>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Peso"
                value={peso}
                onChange={(e) => setPeso(e.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder={unidade === "g" ? "450" : "0,450"}
                className="num min-h-16 min-w-0 flex-1 rounded-botao border border-borda bg-superficie px-4 text-right text-4xl font-bold focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
              />
              <div className="flex flex-col gap-1 rounded-botao bg-superficie-2 p-1">
                {(["g", "kg"] as const).map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setUnidade(u)}
                    aria-pressed={unidade === u}
                    className={cx("min-h-[30px] w-14 rounded-lg text-sm font-semibold", unidade === u ? "bg-superficie text-marca shadow-sm" : "text-texto-2")}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <p className="num text-center text-texto-2">
              {gramas ? (
                <>
                  {formatarPeso(gramas)} × {formatarBRL(precoKg)} ≈{" "}
                  <strong className="text-texto">{formatarBRL(Math.round(gramas * precoKg / 10) / 100)}</strong>
                </>
              ) : (
                "Digite o peso do prato"
              )}
            </p>
            <Botao grande type="submit" disabled={!gramas} carregando={ocupado}>
              <Check className="size-6" aria-hidden /> Lançar pesagem
            </Botao>
          </form>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 text-lg font-bold">Itens avulsos</h2>
          {avulsos.length === 0 ? (
            <p className="text-sm text-texto-2">O gerente ainda não cadastrou itens avulsos.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {avulsos.map((a) => (
                <button
                  key={a.id}
                  disabled={ocupado}
                  onClick={() => rpc("lancar_avulso", { p_comanda: comandaId, p_item: a.id, p_quantidade: 1 }, `${a.nome} lançado.`)}
                  className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-[18px] border border-borda bg-superficie-2 p-2 text-center transition hover:border-marca hover:bg-marca-clara/50 active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="text-3xl" aria-hidden>{a.emoji ?? "🍽️"}</span>
                  <span className="text-sm font-semibold leading-tight">{a.nome}</span>
                  <span className="num text-sm text-texto-2">{formatarBRL(a.preco)}</span>
                </button>
              ))}
            </div>
          )}
        </Cartao>
      </section>
    </main>
  );
}

function EditarItem({
  item,
  modo,
  ocupado,
  cancelar,
  confirmar,
}: {
  item: ItemComanda;
  modo: "corrigir" | "remover";
  ocupado: boolean;
  cancelar: () => void;
  confirmar: (valor: string) => void;
}) {
  const inicial = modo === "remover" ? "" : String(item.tipo === "pesagem" ? item.peso_g : item.quantidade);
  const [valor, setValor] = useState(inicial);
  return (
    <Cartao className="border-marca">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirmar(valor);
        }}
        className="flex flex-col gap-3"
      >
        <h3 className="font-bold">
          {modo === "remover" ? "Remover" : "Corrigir"} {item.descricao} ({formatarBRL(item.valor)})
        </h3>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {modo === "remover" ? "Motivo (fica no registro de auditoria)" : item.tipo === "pesagem" ? "Peso correto em gramas" : "Quantidade correta"}
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode={modo === "remover" ? "text" : "numeric"}
            required
            placeholder={modo === "remover" ? "Lançado por engano" : ""}
            className="num min-h-12 rounded-botao border border-borda bg-superficie px-4 text-lg focus:border-marca focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Botao type="button" variante="secundario" onClick={cancelar}>Cancelar</Botao>
          <Botao type="submit" variante={modo === "remover" ? "perigo" : "primario"} carregando={ocupado}>
            {modo === "remover" ? <Trash2 className="size-5" /> : <Check className="size-5" />}
            Confirmar
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}
