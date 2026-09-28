"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta, Botao, Campo } from "@/components/ui";
import { identificadorParaEmail } from "@/lib/formato";
import { supabaseNavegador } from "@/lib/supabase/client";

export function FormCadastro({ destino }: { destino: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const identificador = String(f.get("identificador"));
    const senha = String(f.get("senha"));
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: f.get("nome"),
          identificador,
          senha,
          cpf: f.get("cpf"),
          aceitouPrivacidade: f.get("privacidade") === "on",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      const { error } = await supabaseNavegador().auth.signInWithPassword({
        email: identificadorParaEmail(identificador),
        password: senha,
      });
      if (error) throw new Error("Conta criada, mas não foi possível entrar. Tente fazer login.");
      router.replace(destino ?? "/app");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Sem conexão. Tente de novo.");
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-3">
      <Campo rotulo="Nome" name="nome" required minLength={2} autoComplete="name" />
      <Campo rotulo="E-mail ou telefone" name="identificador" required autoComplete="username" placeholder="voce@email.com ou (11) 98888-7777" />
      <Campo rotulo="Senha" name="senha" type="password" required minLength={6} autoComplete="new-password" ajuda="Mínimo de 6 caracteres." />
      <Campo rotulo="CPF (opcional)" name="cpf" inputMode="numeric" ajuda="Só se você quiser CPF na nota." />
      <label className="flex items-start gap-3 rounded-botao bg-superficie-2 p-3 text-sm">
        <input type="checkbox" name="privacidade" required className="mt-0.5 size-5 accent-[var(--marca)]" />
        <span>
          Li e aceito o{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-marca underline">
            aviso de privacidade
          </Link>
          . Usamos seus dados só para a comanda, o pagamento e a saída (LGPD).
        </span>
      </label>
      {erro && <Alerta>{erro}</Alerta>}
      <Botao grande type="submit" carregando={ocupado} className="mt-1">
        Criar conta
      </Botao>
    </form>
  );
}
