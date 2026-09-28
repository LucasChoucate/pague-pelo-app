-- Migração 002: exclusão de itens avulsos, funcionários e restaurantes.
-- Para bancos criados com a versão anterior do schema.sql.

alter table public.itens_comanda
  drop constraint if exists itens_comanda_item_avulso_id_fkey,
  add constraint itens_comanda_item_avulso_id_fkey
    foreign key (item_avulso_id) references public.itens_avulsos (id) on delete set null;

alter table public.usuarios add column if not exists excluido_em timestamptz;

create or replace function public.excluir_dados_restaurante(p_restaurante uuid)
returns uuid[]
language plpgsql security definer set search_path = public as $$
declare equipe uuid[];
begin
  select coalesce(array_agg(id), '{}') into equipe from public.usuarios where restaurante_id = p_restaurante;
  delete from public.nps              where restaurante_id = p_restaurante;
  delete from public.validacoes_saida where restaurante_id = p_restaurante;
  delete from public.pagamentos       where restaurante_id = p_restaurante;
  delete from public.itens_comanda    where restaurante_id = p_restaurante;
  delete from public.comandas         where restaurante_id = p_restaurante;
  delete from public.auditoria        where restaurante_id = p_restaurante or usuario_id = any (equipe);
  delete from public.movimento_diario where restaurante_id = p_restaurante;
  delete from public.itens_avulsos    where restaurante_id = p_restaurante;
  update public.comandas set cancelada_por = null where cancelada_por = any (equipe);
  return equipe;
end $$;

revoke execute on function public.excluir_dados_restaurante(uuid) from public, anon, authenticated;
grant execute on function public.excluir_dados_restaurante(uuid) to service_role;
