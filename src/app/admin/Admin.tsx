"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alerta, Botao, Campo } from "@/components/ui";

async function chamar(metodo: string, corpo: unknown) {
  const r = await fetch("/api/admin/restaurantes", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? "Falha ao salvar.");
  return j;
}

function paraSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NovoRestaurante() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setOcupado(true);
    setMsg(null);
    try {
      await chamar("POST", {
        nome: f.get("nome"),
        slug,
        preco_kg: Number(String(f.get("preco")).replace(",", ".")),
        cor_destaque: f.get("cor"),
        gerente: { nome: f.get("g_nome"), identificador: f.get("g_login"), senha: f.get("g_senha") },
      });
      setMsg({ tipo: "ok", texto: "Restaurante e gerente criados." });
      form.reset();
      setSlug("");
      setSlugEditado(false);
      router.refresh();
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-3">
      <Campo rotulo="Nome" name="nome" required onChange={(e) => !slugEditado && setSlug(paraSlug(e.target.value))} />
      <Campo
        rotulo="Slug (endereço do QR de entrada)"
        name="slug"
        value={slug}
        onChange={(e) => {
          setSlugEditado(true);
          setSlug(paraSlug(e.target.value));
        }}
        required
        ajuda={slug ? `/entrar?loja=${slug}` : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Preço do kg (R$)" name="preco" inputMode="decimal" required placeholder="69,90" />
        <Campo rotulo="Cor de destaque" name="cor" type="color" defaultValue="#0F766E" />
      </div>
      <p className="mt-2 text-sm font-semibold">Gerente</p>
      <Campo rotulo="Nome do gerente" name="g_nome" required />
      <Campo rotulo="E-mail ou telefone (login)" name="g_login" required autoComplete="off" />
      <Campo rotulo="Senha inicial" name="g_senha" required minLength={6} autoComplete="off" />
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <Botao type="submit" carregando={ocupado}>Cadastrar restaurante</Botao>
    </form>
  );
}

export function AcoesRestaurante({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function executar(metodo: string, corpo: unknown) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar(metodo, corpo);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (excluindo) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-botao border border-erro/40 bg-erro/5 p-3">
        <p className="text-sm font-semibold text-erro-texto">
          Isso apaga para sempre o restaurante, todas as comandas, pagamentos, avaliações, itens e as contas da equipe.
        </p>
        <label className="text-sm">
          Para confirmar, digite <strong>{nome}</strong>
          <input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoFocus
            className="mt-1 min-h-12 w-full rounded-botao border border-borda bg-superficie px-3"
          />
        </label>
        {erro && <p className="text-sm font-medium text-erro-texto">{erro}</p>}
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => { setExcluindo(false); setConfirmacao(""); }}>Cancelar</Botao>
          <Botao variante="perigo" carregando={ocupado} disabled={confirmacao.trim() !== nome} onClick={() => executar("DELETE", { id, confirmacao })}>
            Excluir para sempre
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Botao variante="secundario" className="text-sm" carregando={ocupado} onClick={() => executar("PATCH", { id, ativo: !ativo })}>
        {ativo ? "Desativar" : "Ativar"}
      </Botao>
      <button
        aria-label={`Excluir ${nome}`}
        onClick={() => setExcluindo(true)}
        className="grid size-12 place-items-center rounded-full text-erro-texto hover:bg-erro/10"
      >
        <Trash2 className="size-5" />
      </button>
    </div>
  );
}
