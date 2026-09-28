import { exigirPapelPagina } from "@/lib/auth";
import { NavCliente } from "./NavCliente";

export default async function LayoutCliente({ children }: LayoutProps<"/app">) {
  await exigirPapelPagina(["cliente"], "/app");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pb-28">
      {children}
      <NavCliente />
    </div>
  );
}
