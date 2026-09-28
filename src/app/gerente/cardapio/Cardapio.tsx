"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { SeletorEmoji } from "@/components/SeletorEmoji";
import { Alerta, Botao, Campo, cx } from "@/components/ui";
import { formatarBRL } from "@/lib/formato";
import type { ItemAvulso } from "@/lib/tipos";

async function chamar(url: string, metodo: string, corpo?: unknown) {
  const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? "Falha ao salvar.");
  return j;
}

const paraNumero = (s: FormDataEntryValue | null) => Number(String(s ?? "").replace(/\./g, "").replace(",", "."));

export function PrecoKg({ inicial }: { inicial: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    try {
      await chamar("/api/gerente/restaurante", "PATCH", { preco_kg: paraNumero(new FormData(e.currentTarget).get("preco")) });
      setMsg({ tipo: "ok", texto: "Preço atualizado (registrado na auditoria)." });
      router.refresh();
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <Campo rotulo="R$ por kg" name="preco" inputMode="decimal" required defaultValue={inicial.toFixed(2).replace(".", ",")} className="num" />
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <Botao type="submit" carregando={ocupado}>Salvar preço</Botao>
    </form>
  );
}

export function FormItem() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setOcupado(true);
    setErro(null);
    try {
      await chamar("/api/gerente/itens", "POST", { nome: f.get("nome"), preco: paraNumero(f.get("preco")), emoji: f.get("emoji") });
      form.reset();
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-3">
      <Campo rotulo="Nome" name="nome" required placeholder="Suco de laranja" />
      <SeletorEmoji name="emoji" />
      <Campo rotulo="Preço (R$)" name="preco" inputMode="decimal" required placeholder="9,90" />
      {erro && <Alerta>{erro}</Alerta>}
      <Botao type="submit" carregando={ocupado}>Adicionar item</Botao>
    </form>
  );
}

export function LinhaItem({ item }: { item: ItemAvulso }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function atualizar(corpo: Record<string, unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("/api/gerente/itens", "PATCH", { id: item.id, ...corpo });
      setEditando(false);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar(`/api/gerente/itens?id=${item.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
      setOcupado(false);
    }
  }

  if (confirmarExclusao) {
    return (
      <li className="flex flex-col gap-3 px-2 py-3">
        <p className="font-semibold">
          Excluir “{item.nome}”? As comandas antigas continuam mostrando o item e o valor cobrado.
        </p>
        {erro && <Alerta>{erro}</Alerta>}
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          <Botao variante="perigo" carregando={ocupado} onClick={excluir}>
            <Trash2 className="size-5" aria-hidden /> Excluir
          </Botao>
        </div>
      </li>
    );
  }

  if (editando) {
    return (
      <li className="px-2 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            atualizar({ nome: f.get("nome"), preco: paraNumero(f.get("preco")), emoji: f.get("emoji") });
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Campo rotulo="Nome" name="nome" defaultValue={item.nome} required />
            <Campo rotulo="Preço" name="preco" defaultValue={Number(item.preco).toFixed(2).replace(".", ",")} inputMode="decimal" required />
          </div>
          <SeletorEmoji name="emoji" inicial={item.emoji} />
          {erro && <Alerta>{erro}</Alerta>}
          <div className="flex gap-2">
            <Botao type="button" variante="secundario" onClick={() => setEditando(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={ocupado}>Salvar</Botao>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={cx("flex min-h-16 items-center gap-3 px-2 py-2", !item.ativo && "opacity-60")}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2 text-2xl" aria-hidden>
        {item.emoji ?? "🍽️"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.nome}</p>
        <p className="num text-sm text-texto-2">
          {formatarBRL(item.preco)} {!item.ativo && "· inativo"}
        </p>
      </div>
      <button aria-label={`Editar ${item.nome}`} onClick={() => setEditando(true)} className="grid size-12 place-items-center rounded-full text-texto-2 hover:bg-superficie-2">
        <Pencil className="size-5" />
      </button>
      <Botao variante="secundario" className="text-sm" carregando={ocupado} onClick={() => atualizar({ ativo: !item.ativo })}>
        {item.ativo ? "Desativar" : "Ativar"}
      </Botao>
      <button
        aria-label={`Excluir ${item.nome}`}
        onClick={() => setConfirmarExclusao(true)}
        className="grid size-12 place-items-center rounded-full text-erro-texto hover:bg-erro/10"
      >
        <Trash2 className="size-5" />
      </button>
    </li>
  );
}
