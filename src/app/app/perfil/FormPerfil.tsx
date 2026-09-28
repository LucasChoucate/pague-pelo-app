"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Botao, Campo } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/client";

export function FormPerfil({ nome, telefone, cpf, email }: { nome: string; telefone: string; cpf: string; email: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const novoCpf = String(f.get("cpf")).replace(/\D/g, "");
    if (novoCpf && novoCpf.length !== 11) {
      setMsg({ tipo: "erro", texto: "CPF deve ter 11 dígitos." });
      return;
    }
    setOcupado(true);
    const supabase = supabaseNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // RLS + permissão de coluna: só nome, telefone e CPF podem mudar.
    const { error } = await supabase
      .from("usuarios")
      .update({
        nome: String(f.get("nome")).trim(),
        telefone: String(f.get("telefone")).replace(/\D/g, "") || null,
        cpf: novoCpf || null,
      })
      .eq("id", user!.id);
    setOcupado(false);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível salvar." } : { tipo: "ok", texto: "Dados salvos." });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {email && <p className="text-sm text-texto-2">Conta: {email}</p>}
      <Campo rotulo="Nome" name="nome" defaultValue={nome} required minLength={2} autoComplete="name" />
      <Campo rotulo="Telefone" name="telefone" defaultValue={telefone} inputMode="tel" autoComplete="tel" />
      <Campo rotulo="CPF (opcional)" name="cpf" defaultValue={cpf} inputMode="numeric" ajuda="Usado só se você quiser CPF na nota." />
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <Botao type="submit" carregando={ocupado}>Salvar</Botao>
    </form>
  );
}
