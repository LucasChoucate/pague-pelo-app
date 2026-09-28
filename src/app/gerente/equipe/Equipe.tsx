"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alerta, Botao, Campo, cx } from "@/components/ui";

async function enviar(metodo: "POST" | "PATCH", corpo: unknown) {
  const r = await fetch("/api/gerente/funcionarios", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? "Falha ao salvar.");
  return j;
}

export function NovoFuncionario() {
  const router = useRouter();
  const [papel, setPapel] = useState<"atendente" | "porteiro">("atendente");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setOcupado(true);
    setMsg(null);
    try {
      await enviar("POST", { nome: f.get("nome"), identificador: f.get("identificador"), senha: f.get("senha"), papel });
      setMsg({ tipo: "ok", texto: "Funcionário criado." });
      form.reset();
      router.refresh();
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-superficie-2 p-1" role="radiogroup" aria-label="Papel">
        {(["atendente", "porteiro"] as const).map((p) => (
          <button
            type="button"
            key={p}
            role="radio"
            aria-checked={papel === p}
            onClick={() => setPapel(p)}
            className={cx("min-h-12 rounded-[10px] font-semibold", papel === p ? "bg-superficie text-marca shadow-sm" : "text-texto-2")}
          >
            {p === "atendente" ? "Atendente de caixa" : "Porteiro"}
          </button>
        ))}
      </div>
      <Campo rotulo="Nome" name="nome" required minLength={2} autoComplete="off" />
      <Campo rotulo="E-mail ou telefone (login)" name="identificador" required autoComplete="off" />
      <Campo rotulo="Senha inicial" name="senha" type="text" required minLength={6} autoComplete="off" />
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <Botao type="submit" carregando={ocupado}>Criar acesso</Botao>
    </form>
  );
}

export function AcoesFuncionario({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (confirmar) {
    return (
      <div className="flex max-w-xs flex-col items-end gap-2 text-right">
        <p className="text-sm font-semibold">Excluir o acesso de {nome}? Não dá para desfazer.</p>
        {erro && <p className="text-xs font-medium text-erro-texto">{erro}</p>}
        <div className="flex gap-2">
          <Botao variante="secundario" className="text-sm" onClick={() => setConfirmar(false)}>Cancelar</Botao>
          <Botao
            variante="perigo"
            className="text-sm"
            carregando={ocupado}
            onClick={() =>
              executar(async () => {
                const r = await fetch(`/api/gerente/funcionarios?id=${id}`, { method: "DELETE" });
                const j = await r.json();
                if (!r.ok) throw new Error(j.erro ?? "Falha ao excluir.");
              })
            }
          >
            Excluir
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Botao variante={ativo ? "secundario" : "primario"} carregando={ocupado} className="text-sm" onClick={() => executar(() => enviar("PATCH", { id, ativo: !ativo }))}>
        {ativo ? "Desativar" : "Reativar"}
      </Botao>
      <button
        aria-label={`Excluir ${nome}`}
        onClick={() => setConfirmar(true)}
        className="grid size-12 place-items-center rounded-full text-erro-texto hover:bg-erro/10"
      >
        <Trash2 className="size-5" />
      </button>
    </div>
  );
}
