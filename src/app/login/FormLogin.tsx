"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Botao, Campo } from "@/components/ui";
import { identificadorParaEmail } from "@/lib/formato";
import { supabaseNavegador } from "@/lib/supabase/client";
import { HOME_DO_PAPEL, type Papel } from "@/lib/tipos";

export function FormLogin({ destino }: { destino: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setOcupado(true);
    const supabase = supabaseNavegador();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identificadorParaEmail(String(f.get("identificador"))),
      password: String(f.get("senha")),
    });
    if (error || !data.user) {
      setOcupado(false);
      setErro(/banned/i.test(error?.message ?? "") ? "Este acesso foi desativado pelo gerente." : "E-mail/telefone ou senha incorretos.");
      return;
    }
    const { data: perfil } = await supabase.from("usuarios").select("papel").eq("id", data.user.id).single();
    const papel = (perfil?.papel ?? "cliente") as Papel;
    // Cliente vai para onde estava indo; funcionário sempre para a própria área.
    router.replace(papel === "cliente" && destino ? destino : HOME_DO_PAPEL[papel]);
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-3">
      <Campo rotulo="E-mail ou telefone" name="identificador" required autoComplete="username" placeholder="voce@email.com ou (11) 98888-7777" />
      <Campo rotulo="Senha" name="senha" type="password" required autoComplete="current-password" />
      {erro && <Alerta>{erro}</Alerta>}
      <Botao grande type="submit" carregando={ocupado} className="mt-1">
        Continuar
      </Botao>
    </form>
  );
}
