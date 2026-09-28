import Link from "next/link";
import { LogoMarca } from "@/components/Marca";
import { Cartao } from "@/components/ui";

export const metadata = { title: "Aviso de privacidade" };

export default function Privacidade() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10">
      <LogoMarca className="text-xl" />
      <Cartao className="prose-sm flex flex-col gap-4 leading-relaxed">
        <h1 className="text-2xl font-bold">Aviso de privacidade</h1>
        <p>
          O Pague pelo App segue a Lei Geral de Proteção de Dados (Lei 13.709/2018). Coletamos só o necessário para
          você usar a comanda digital, pagar e sair do restaurante.
        </p>
        <h2 className="text-lg font-semibold">Quais dados coletamos</h2>
        <ul className="list-disc pl-5">
          <li>Nome, e-mail ou telefone e senha (guardada criptografada): para identificar sua conta.</li>
          <li>CPF, só se você informar: para constar na nota.</li>
          <li>Itens consumidos, valores, horários de pagamento e de saída: para a comanda funcionar e para o restaurante medir o atendimento.</li>
          <li>Nota e comentário da pesquisa de satisfação, se você responder.</li>
        </ul>
        <h2 className="text-lg font-semibold">O que não fazemos</h2>
        <ul className="list-disc pl-5">
          <li>Não guardamos dados completos de cartão: o pagamento é processado pelo provedor de pagamento.</li>
          <li>Não vendemos nem compartilhamos seus dados para publicidade.</li>
          <li>Cada restaurante vê só as comandas feitas nele, nunca as de outros restaurantes.</li>
        </ul>
        <h2 className="text-lg font-semibold">Seus direitos</h2>
        <p>
          Você pode ver e corrigir seus dados na tela de Perfil e pedir a exclusão da conta a qualquer momento pelo
          e-mail de suporte do restaurante ou da plataforma.
        </p>
        <p className="text-sm text-texto-2">Versão de demonstração (MVP). Revise este texto com um advogado antes de usar em produção.</p>
      </Cartao>
      <Link href="/" className="font-semibold text-marca hover:underline">Voltar</Link>
    </main>
  );
}
