-- =====================================================================
-- Pague pelo App — schema completo (Postgres / Supabase)
--
-- Rode este arquivo inteiro no SQL Editor de um projeto Supabase NOVO.
-- Ele cria tabelas, índices, funções de negócio, políticas de acesso
-- (RLS), publicação Realtime e o bucket de logos.
--
-- Princípios:
--   * Clientes e funcionários só LEEM direto do banco (RLS).
--   * Toda escrita passa por funções SECURITY DEFINER que conferem
--     papel e restaurante (lançar item, abrir comanda, NPS...) ou por
--     rotas do servidor que usam a service role (pagamento, saída,
--     gestão). Valores sempre são calculados aqui, nunca no front.
--   * Toda alteração de valor gera linha em `auditoria`.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario as enum
  ('cliente', 'atendente', 'porteiro', 'gerente', 'admin_plataforma');

create type public.status_comanda as enum
  ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA', 'FINALIZADA', 'CANCELADA', 'EXPIRADA');

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.restaurantes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url      text,
  cor_destaque  text not null default '#0F766E' check (cor_destaque ~ '^#[0-9A-Fa-f]{6}$'),
  preco_kg      numeric(10,2) not null check (preco_kg > 0),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table public.usuarios (
  id              uuid primary key references auth.users (id) on delete cascade,
  nome            text not null,
  email           text,
  telefone        text,
  cpf             text,
  papel           public.papel_usuario not null default 'cliente',
  restaurante_id  uuid references public.restaurantes (id),
  ativo           boolean not null default true,
  excluido_em     timestamptz, -- funcionário excluído (mantido para o histórico)
  aceitou_privacidade_em timestamptz,
  criado_em       timestamptz not null default now(),
  -- Funcionário sempre pertence a um restaurante; cliente e admin da plataforma nunca.
  constraint usuarios_vinculo_restaurante check (
    (papel in ('cliente', 'admin_plataforma') and restaurante_id is null)
    or (papel in ('atendente', 'porteiro', 'gerente') and restaurante_id is not null)
  )
);

create table public.itens_avulsos (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes (id) on delete cascade,
  nome            text not null,
  preco           numeric(10,2) not null check (preco > 0),
  emoji           text,
  ordem           int not null default 0,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

create table public.comandas (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes (id),
  cliente_id      uuid not null references public.usuarios (id),
  codigo_curto    text not null,
  status          public.status_comanda not null default 'ABERTA',
  total           numeric(10,2) not null default 0,
  total_pago      numeric(10,2) not null default 0,
  criada_em       timestamptz not null default now(),
  paga_em         timestamptz,
  saida_em        timestamptz,
  cancelada_motivo text,
  cancelada_por   uuid references public.usuarios (id)
);

-- REGRA: no máximo 1 comanda ativa por conta, em qualquer restaurante.
create unique index comandas_uma_ativa_por_cliente
  on public.comandas (cliente_id)
  where status in ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA');

-- Código curto é único entre as comandas ativas de um restaurante.
create unique index comandas_codigo_ativo
  on public.comandas (restaurante_id, codigo_curto)
  where status in ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA');

create index comandas_restaurante_data on public.comandas (restaurante_id, criada_em desc);

create table public.itens_comanda (
  id              uuid primary key default gen_random_uuid(),
  comanda_id      uuid not null references public.comandas (id) on delete cascade,
  restaurante_id  uuid not null references public.restaurantes (id),
  tipo            text not null check (tipo in ('pesagem', 'avulso')),
  item_avulso_id  uuid references public.itens_avulsos (id) on delete set null, -- descrição e preço ficam copiados no item
  descricao       text not null,
  peso_g          int check (peso_g is null or peso_g > 0),
  quantidade      int not null default 1 check (quantidade > 0),
  preco_unit      numeric(10,2) not null,
  valor           numeric(10,2) not null,
  lancado_por     uuid not null references public.usuarios (id),
  criado_em       timestamptz not null default now(),
  removido_em     timestamptz,
  removido_por    uuid references public.usuarios (id),
  motivo_remocao  text
);
create index itens_comanda_comanda on public.itens_comanda (comanda_id);

create table public.pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  comanda_id          uuid not null references public.comandas (id),
  restaurante_id      uuid not null references public.restaurantes (id),
  cliente_id          uuid not null references public.usuarios (id),
  metodo              text not null check (metodo in ('pix', 'cartao')),
  valor               numeric(10,2) not null check (valor > 0),
  status              text not null default 'pendente'
                        check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  motivo              text,
  referencia_externa  text,
  pix_copia_e_cola    text,
  cartao_final        text,
  criado_em           timestamptz not null default now(),
  aprovado_em         timestamptz
);
create index pagamentos_comanda on public.pagamentos (comanda_id);

create table public.validacoes_saida (
  id              uuid primary key default gen_random_uuid(),
  comanda_id      uuid references public.comandas (id),
  restaurante_id  uuid not null references public.restaurantes (id),
  porteiro_id     uuid not null references public.usuarios (id),
  resultado       text not null check (resultado in ('liberada', 'bloqueada')),
  motivo          text,
  metodo          text not null check (metodo in ('qr', 'codigo')),
  duracao_ms      int,
  criado_em       timestamptz not null default now()
);
create index validacoes_restaurante_data on public.validacoes_saida (restaurante_id, criado_em desc);

create table public.nps (
  id              uuid primary key default gen_random_uuid(),
  comanda_id      uuid not null unique references public.comandas (id),
  restaurante_id  uuid not null references public.restaurantes (id),
  cliente_id      uuid not null references public.usuarios (id),
  nota            int not null check (nota between 0 and 10),
  comentario      text check (comentario is null or length(comentario) <= 500),
  criado_em       timestamptz not null default now()
);

create table public.auditoria (
  id              bigint generated always as identity primary key,
  usuario_id      uuid references public.usuarios (id),
  restaurante_id  uuid references public.restaurantes (id),
  acao            text not null,
  entidade        text not null,
  entidade_id     text,
  antes           jsonb,
  depois          jsonb,
  criado_em       timestamptz not null default now()
);
create index auditoria_restaurante_data on public.auditoria (restaurante_id, criado_em desc);

-- Quantos clientes pagaram no caixa tradicional em cada dia
-- (informado pelo gerente). Base para a taxa de adoção.
create table public.movimento_diario (
  restaurante_id  uuid not null references public.restaurantes (id) on delete cascade,
  data            date not null,
  clientes_caixa  int not null default 0 check (clientes_caixa >= 0),
  primary key (restaurante_id, data)
);

-- ---------------------------------------------------------------------
-- Funções auxiliares de acesso (usadas nas políticas)
-- ---------------------------------------------------------------------
create or replace function public.meu_papel() returns public.papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function public.meu_restaurante() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurante_id from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function public.eh_equipe_de(p_restaurante uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and ativo and restaurante_id = p_restaurante
      and papel in ('atendente', 'porteiro', 'gerente')
  )
$$;

create or replace function public.eh_gerente_de(p_restaurante uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and ativo and restaurante_id = p_restaurante and papel = 'gerente'
  )
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios where id = auth.uid() and ativo and papel = 'admin_plataforma'
  )
$$;

-- ---------------------------------------------------------------------
-- Perfil criado automaticamente para todo novo usuário do Auth.
-- Sempre nasce como CLIENTE: o papel de funcionário só é definido
-- pelo servidor (rota do gerente/admin), nunca pelo metadado enviado
-- no cadastro.
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nome, email, telefone, cpf, papel, aceitou_privacidade_em)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    case when new.email like '%@tel.paguepeloapp.local' then null else new.email end,
    nullif(new.raw_user_meta_data ->> 'telefone', ''),
    nullif(new.raw_user_meta_data ->> 'cpf', ''),
    'cliente',
    case when (new.raw_user_meta_data ->> 'aceitou_privacidade') = 'true' then now() end
  );
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_usuario();

-- ---------------------------------------------------------------------
-- Funções internas (não expostas a clientes)
-- ---------------------------------------------------------------------
create or replace function public.registrar_auditoria(
  p_restaurante uuid, p_acao text, p_entidade text, p_entidade_id text,
  p_antes jsonb, p_depois jsonb, p_usuario uuid default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.auditoria (usuario_id, restaurante_id, acao, entidade, entidade_id, antes, depois)
  values (coalesce(p_usuario, auth.uid()), p_restaurante, p_acao, p_entidade, p_entidade_id, p_antes, p_depois)
$$;

create or replace function public.gerar_codigo_curto() returns text
language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem 0/O, 1/I/L
  r text := '';
begin
  for i in 1..4 loop
    r := r || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return r;
end $$;

-- Recalcula total e status a partir dos itens. Única fonte de verdade.
create or replace function public.recalcular_comanda(p_comanda uuid) returns public.comandas
language plpgsql security definer set search_path = public as $$
declare
  c public.comandas;
  v_total numeric(10,2);
  v_status public.status_comanda;
begin
  select * into c from public.comandas where id = p_comanda for update;
  select coalesce(sum(valor), 0) into v_total
    from public.itens_comanda where comanda_id = p_comanda and removido_em is null;

  if c.status in ('FINALIZADA', 'CANCELADA', 'EXPIRADA') then
    v_status := c.status;
  elsif v_total = 0 and c.total_pago = 0 then
    v_status := 'ABERTA';
  elsif c.total_pago >= v_total then
    v_status := 'PAGA';
  else
    v_status := 'PENDENTE_PAGAMENTO';
  end if;

  update public.comandas
     set total = v_total,
         status = v_status,
         paga_em = case when v_status = 'PAGA' and c.status <> 'PAGA' then now() else paga_em end
   where id = p_comanda
  returning * into c;
  return c;
end $$;

-- Garante que quem chama é atendente do restaurante da comanda e que
-- a comanda aceita lançamentos. Devolve a comanda travada.
create or replace function public._comanda_para_lancamento(p_comanda uuid) returns public.comandas
language plpgsql security definer set search_path = public as $$
declare c public.comandas;
begin
  if public.meu_papel() is distinct from 'atendente' then
    raise exception 'Só atendentes podem lançar itens.';
  end if;
  select * into c from public.comandas where id = p_comanda for update;
  if not found or c.restaurante_id is distinct from public.meu_restaurante() then
    raise exception 'Comanda não encontrada neste restaurante.';
  end if;
  if c.status not in ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA') then
    raise exception 'Esta comanda está %, não aceita lançamentos.', lower(c.status::text);
  end if;
  return c;
end $$;

-- Expira comandas ABERTAS sem itens de dias anteriores (fuso de São Paulo).
create or replace function public.expirar_comandas_vazias(p_cliente uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.comandas c
     set status = 'EXPIRADA'
   where c.status = 'ABERTA'
     and (p_cliente is null or c.cliente_id = p_cliente)
     and (c.criada_em at time zone 'America/Sao_Paulo')::date
         < (now() at time zone 'America/Sao_Paulo')::date
     and not exists (
       select 1 from public.itens_comanda i where i.comanda_id = c.id and i.removido_em is null
     );
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Funções de negócio chamadas pelo app (RPC)
-- ---------------------------------------------------------------------

-- CLIENTE: pega a comanda na entrada do restaurante.
create or replace function public.abrir_comanda(p_slug text) returns public.comandas
language plpgsql security definer set search_path = public as $$
declare
  r public.restaurantes;
  c public.comandas;
  tentativas int := 0;
begin
  if auth.uid() is null then
    raise exception 'Faça login para pegar sua comanda.';
  end if;
  if public.meu_papel() is distinct from 'cliente' then
    raise exception 'Só contas de cliente podem abrir comanda.';
  end if;
  select * into r from public.restaurantes where slug = p_slug and ativo;
  if not found then
    raise exception 'Restaurante não encontrado.';
  end if;

  perform public.expirar_comandas_vazias(auth.uid());

  if exists (
    select 1 from public.comandas
    where cliente_id = auth.uid() and status in ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA')
  ) then
    raise exception 'Você já tem uma comanda ativa. Pague e valide a saída antes de abrir outra.';
  end if;

  loop
    begin
      insert into public.comandas (restaurante_id, cliente_id, codigo_curto)
      values (r.id, auth.uid(), public.gerar_codigo_curto())
      returning * into c;
      return c;
    exception when unique_violation then
      -- Corrida com outra aba do mesmo cliente: o índice único barra.
      if exists (
        select 1 from public.comandas
        where cliente_id = auth.uid() and status in ('ABERTA', 'PENDENTE_PAGAMENTO', 'PAGA')
      ) then
        raise exception 'Você já tem uma comanda ativa. Pague e valide a saída antes de abrir outra.';
      end if;
      -- Colisão de código curto: tenta outro.
      tentativas := tentativas + 1;
      if tentativas >= 20 then
        raise exception 'Não foi possível gerar o código da comanda. Tente de novo.';
      end if;
    end;
  end loop;
end $$;

-- ATENDENTE: pesagem. Preço do kg vem do restaurante, nunca do front.
create or replace function public.lancar_pesagem(p_comanda uuid, p_peso_g int)
returns public.itens_comanda
language plpgsql security definer set search_path = public as $$
declare
  c public.comandas;
  v_preco numeric(10,2);
  it public.itens_comanda;
begin
  c := public._comanda_para_lancamento(p_comanda);
  if p_peso_g is null or p_peso_g < 1 or p_peso_g > 5000 then
    raise exception 'Peso inválido. Informe entre 1 g e 5 kg.';
  end if;
  select preco_kg into v_preco from public.restaurantes where id = c.restaurante_id;

  insert into public.itens_comanda
    (comanda_id, restaurante_id, tipo, descricao, peso_g, quantidade, preco_unit, valor, lancado_por)
  values
    (c.id, c.restaurante_id, 'pesagem', 'Prato a quilo', p_peso_g, 1, v_preco,
     round(p_peso_g * v_preco / 1000.0, 2), auth.uid())
  returning * into it;

  perform public.recalcular_comanda(c.id);
  perform public.registrar_auditoria(c.restaurante_id, 'lancar_item', 'itens_comanda', it.id::text, null, to_jsonb(it));
  return it;
end $$;

-- ATENDENTE: item avulso (bebida, sobremesa...).
create or replace function public.lancar_avulso(p_comanda uuid, p_item uuid, p_quantidade int default 1)
returns public.itens_comanda
language plpgsql security definer set search_path = public as $$
declare
  c public.comandas;
  a public.itens_avulsos;
  it public.itens_comanda;
begin
  c := public._comanda_para_lancamento(p_comanda);
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 50 then
    raise exception 'Quantidade inválida.';
  end if;
  select * into a from public.itens_avulsos
   where id = p_item and restaurante_id = c.restaurante_id and ativo;
  if not found then
    raise exception 'Item não encontrado no cardápio deste restaurante.';
  end if;

  insert into public.itens_comanda
    (comanda_id, restaurante_id, tipo, item_avulso_id, descricao, quantidade, preco_unit, valor, lancado_por)
  values
    (c.id, c.restaurante_id, 'avulso', a.id, a.nome, p_quantidade, a.preco, a.preco * p_quantidade, auth.uid())
  returning * into it;

  perform public.recalcular_comanda(c.id);
  perform public.registrar_auditoria(c.restaurante_id, 'lancar_item', 'itens_comanda', it.id::text, null, to_jsonb(it));
  return it;
end $$;

-- ATENDENTE: corrige peso (pesagem) ou quantidade (avulso) de um item.
create or replace function public.corrigir_item(
  p_item uuid, p_peso_g int default null, p_quantidade int default null
) returns public.itens_comanda
language plpgsql security definer set search_path = public as $$
declare
  antes public.itens_comanda;
  depois public.itens_comanda;
  c public.comandas;
begin
  select * into antes from public.itens_comanda where id = p_item;
  if not found then raise exception 'Item não encontrado.'; end if;
  c := public._comanda_para_lancamento(antes.comanda_id);
  if antes.removido_em is not null then raise exception 'Item já foi removido.'; end if;

  if antes.tipo = 'pesagem' then
    if p_peso_g is null or p_peso_g < 1 or p_peso_g > 5000 then
      raise exception 'Peso inválido. Informe entre 1 g e 5 kg.';
    end if;
    update public.itens_comanda
       set peso_g = p_peso_g, valor = round(p_peso_g * preco_unit / 1000.0, 2)
     where id = p_item returning * into depois;
  else
    if p_quantidade is null or p_quantidade < 1 or p_quantidade > 50 then
      raise exception 'Quantidade inválida.';
    end if;
    update public.itens_comanda
       set quantidade = p_quantidade, valor = preco_unit * p_quantidade
     where id = p_item returning * into depois;
  end if;

  perform public.recalcular_comanda(c.id);
  perform public.registrar_auditoria(c.restaurante_id, 'corrigir_item', 'itens_comanda', p_item::text, to_jsonb(antes), to_jsonb(depois));
  return depois;
end $$;

-- ATENDENTE: remove item lançado por engano (remoção lógica, fica no histórico).
create or replace function public.remover_item(p_item uuid, p_motivo text default null)
returns public.itens_comanda
language plpgsql security definer set search_path = public as $$
declare
  antes public.itens_comanda;
  depois public.itens_comanda;
  c public.comandas;
begin
  select * into antes from public.itens_comanda where id = p_item;
  if not found then raise exception 'Item não encontrado.'; end if;
  c := public._comanda_para_lancamento(antes.comanda_id);
  if antes.removido_em is not null then raise exception 'Item já foi removido.'; end if;

  update public.itens_comanda
     set removido_em = now(), removido_por = auth.uid(), motivo_remocao = nullif(trim(p_motivo), '')
   where id = p_item returning * into depois;

  perform public.recalcular_comanda(c.id);
  perform public.registrar_auditoria(c.restaurante_id, 'remover_item', 'itens_comanda', p_item::text, to_jsonb(antes), to_jsonb(depois));
  return depois;
end $$;

-- GERENTE: cancela comanda com justificativa.
create or replace function public.cancelar_comanda(p_comanda uuid, p_motivo text)
returns public.comandas
language plpgsql security definer set search_path = public as $$
declare
  antes public.comandas;
  depois public.comandas;
begin
  select * into antes from public.comandas where id = p_comanda for update;
  if not found or not public.eh_gerente_de(antes.restaurante_id) then
    raise exception 'Só o gerente deste restaurante pode cancelar a comanda.';
  end if;
  if length(coalesce(trim(p_motivo), '')) < 5 then
    raise exception 'Escreva uma justificativa (mínimo de 5 caracteres).';
  end if;
  if antes.status in ('FINALIZADA', 'CANCELADA', 'EXPIRADA') then
    raise exception 'Esta comanda já está encerrada.';
  end if;

  update public.comandas
     set status = 'CANCELADA', cancelada_motivo = trim(p_motivo), cancelada_por = auth.uid()
   where id = p_comanda returning * into depois;

  update public.pagamentos set status = 'cancelado', motivo = 'Comanda cancelada'
   where comanda_id = p_comanda and status = 'pendente';

  perform public.registrar_auditoria(antes.restaurante_id, 'cancelar_comanda', 'comandas', p_comanda::text, to_jsonb(antes), to_jsonb(depois));
  return depois;
end $$;

-- CLIENTE: pesquisa NPS depois da saída.
create or replace function public.enviar_nps(p_comanda uuid, p_nota int, p_comentario text default null)
returns public.nps
language plpgsql security definer set search_path = public as $$
declare
  c public.comandas;
  n public.nps;
begin
  select * into c from public.comandas where id = p_comanda;
  if not found or c.cliente_id is distinct from auth.uid() then
    raise exception 'Comanda não encontrada.';
  end if;
  if c.status <> 'FINALIZADA' then
    raise exception 'A avaliação fica disponível depois da saída.';
  end if;
  if p_nota is null or p_nota < 0 or p_nota > 10 then
    raise exception 'Nota deve ser de 0 a 10.';
  end if;
  insert into public.nps (comanda_id, restaurante_id, cliente_id, nota, comentario)
  values (c.id, c.restaurante_id, c.cliente_id, p_nota, nullif(trim(left(p_comentario, 500)), ''))
  on conflict (comanda_id) do nothing
  returning * into n;
  if n.id is null then
    raise exception 'Você já avaliou esta visita. Obrigado!';
  end if;
  return n;
end $$;

-- SERVIDOR (service role): confirma um pagamento aprovado pelo gateway.
-- Nunca exposta ao navegador.
create or replace function public.confirmar_pagamento(p_pagamento uuid, p_referencia text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.pagamentos;
  c public.comandas;
  v_saldo numeric(10,2);
begin
  select * into p from public.pagamentos where id = p_pagamento for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Pagamento não encontrado.');
  end if;
  if p.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'motivo', 'Este pagamento já foi processado.');
  end if;

  select * into c from public.comandas where id = p.comanda_id for update;
  v_saldo := c.total - c.total_pago;

  -- Se o saldo DIMINUIU desde que a cobrança foi gerada (item removido),
  -- não aceitamos cobrar a mais: o cliente gera nova cobrança.
  if c.status not in ('PENDENTE_PAGAMENTO') or p.valor > v_saldo then
    update public.pagamentos
       set status = 'cancelado', motivo = 'O valor da comanda mudou. Gere uma nova cobrança.'
     where id = p.id;
    return jsonb_build_object('ok', false, 'motivo', 'O valor da comanda mudou. Gere uma nova cobrança.');
  end if;

  update public.pagamentos
     set status = 'aprovado', aprovado_em = now(), referencia_externa = p_referencia
   where id = p.id returning * into p;

  update public.comandas set total_pago = total_pago + p.valor where id = c.id;
  c := public.recalcular_comanda(c.id);

  perform public.registrar_auditoria(
    c.restaurante_id, 'pagamento_aprovado', 'pagamentos', p.id::text, null, to_jsonb(p), p.cliente_id);

  return jsonb_build_object('ok', true, 'status', c.status, 'saldo', c.total - c.total_pago);
end $$;

-- SERVIDOR (service role): apaga todos os dados de um restaurante antes
-- de excluí-lo. Devolve os ids dos funcionários, que o servidor remove
-- do Auth em seguida (e com eles os perfis).
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
  -- Referências da equipe em comandas de outros lugares (não deveria haver).
  update public.comandas set cancelada_por = null where cancelada_por = any (equipe);
  return equipe;
end $$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- (no Postgres toda função nasce executável por PUBLIC)
-- ---------------------------------------------------------------------
revoke execute on function public.registrar_auditoria(uuid, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.gerar_codigo_curto() from public, anon, authenticated;
revoke execute on function public.recalcular_comanda(uuid) from public, anon, authenticated;
revoke execute on function public._comanda_para_lancamento(uuid) from public, anon, authenticated;
revoke execute on function public.expirar_comandas_vazias(uuid) from public, anon, authenticated;
revoke execute on function public.confirmar_pagamento(uuid, text) from public, anon, authenticated;
revoke execute on function public.excluir_dados_restaurante(uuid) from public, anon, authenticated;
grant execute on function public.excluir_dados_restaurante(uuid) to service_role;
revoke execute on function public.criar_perfil_usuario() from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(uuid, text) to service_role;
grant execute on function public.expirar_comandas_vazias(uuid) to service_role;

revoke execute on function public.abrir_comanda(text) from public, anon;
revoke execute on function public.lancar_pesagem(uuid, int) from public, anon;
revoke execute on function public.lancar_avulso(uuid, uuid, int) from public, anon;
revoke execute on function public.corrigir_item(uuid, int, int) from public, anon;
revoke execute on function public.remover_item(uuid, text) from public, anon;
revoke execute on function public.cancelar_comanda(uuid, text) from public, anon;
revoke execute on function public.enviar_nps(uuid, int, text) from public, anon;
grant execute on function public.abrir_comanda(text) to authenticated;
grant execute on function public.lancar_pesagem(uuid, int) to authenticated;
grant execute on function public.lancar_avulso(uuid, uuid, int) to authenticated;
grant execute on function public.corrigir_item(uuid, int, int) to authenticated;
grant execute on function public.remover_item(uuid, text) to authenticated;
grant execute on function public.cancelar_comanda(uuid, text) to authenticated;
grant execute on function public.enviar_nps(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- Permissões explícitas da Data API (funciona com ou sem a opção
-- "Automatically expose new tables" do Supabase). O navegador só lê;
-- quem filtra as linhas é o RLS abaixo.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Sem políticas de INSERT/UPDATE/DELETE = escrita direta bloqueada.
-- ---------------------------------------------------------------------
alter table public.restaurantes      enable row level security;
alter table public.usuarios          enable row level security;
alter table public.itens_avulsos     enable row level security;
alter table public.comandas          enable row level security;
alter table public.itens_comanda     enable row level security;
alter table public.pagamentos        enable row level security;
alter table public.validacoes_saida  enable row level security;
alter table public.nps               enable row level security;
alter table public.auditoria         enable row level security;
alter table public.movimento_diario  enable row level security;

-- Restaurantes: dados públicos (nome, logo, cor, preço) para a tela de entrada.
create policy restaurantes_leitura on public.restaurantes for select
  using (ativo or public.eh_equipe_de(id) or public.eh_admin());

-- Usuários: cada um vê o próprio perfil; equipe vê clientes com comanda no
-- restaurante e colegas; admin vê todos.
create policy usuarios_proprio on public.usuarios for select
  using (id = auth.uid());
create policy usuarios_equipe on public.usuarios for select
  using (
    (restaurante_id is not null and public.eh_equipe_de(restaurante_id))
    or exists (
      select 1 from public.comandas c
      where c.cliente_id = usuarios.id and public.eh_equipe_de(c.restaurante_id)
    )
  );
create policy usuarios_admin on public.usuarios for select using (public.eh_admin());

-- O cliente pode editar só nome, telefone e CPF do próprio perfil.
create policy usuarios_editar_proprio on public.usuarios for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.usuarios from anon, authenticated;
grant update (nome, telefone, cpf) on public.usuarios to authenticated;

create policy itens_avulsos_leitura on public.itens_avulsos for select
  using (ativo or public.eh_equipe_de(restaurante_id) or public.eh_admin());

create policy comandas_leitura on public.comandas for select
  using (cliente_id = auth.uid() or public.eh_equipe_de(restaurante_id) or public.eh_admin());

create policy itens_comanda_leitura on public.itens_comanda for select
  using (
    public.eh_equipe_de(restaurante_id)
    or exists (select 1 from public.comandas c where c.id = comanda_id and c.cliente_id = auth.uid())
  );

create policy pagamentos_leitura on public.pagamentos for select
  using (cliente_id = auth.uid() or public.eh_equipe_de(restaurante_id) or public.eh_admin());

create policy validacoes_leitura on public.validacoes_saida for select
  using (public.eh_equipe_de(restaurante_id));

create policy nps_leitura on public.nps for select
  using (cliente_id = auth.uid() or public.eh_gerente_de(restaurante_id));

create policy auditoria_leitura on public.auditoria for select
  using (public.eh_gerente_de(restaurante_id) or public.eh_admin());

create policy movimento_leitura on public.movimento_diario for select
  using (public.eh_gerente_de(restaurante_id));

-- ---------------------------------------------------------------------
-- Realtime: a tela do cliente e do caixa escutam estas tabelas.
-- O Realtime respeita as políticas de RLS acima.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.comandas, public.itens_comanda, public.pagamentos;

-- ---------------------------------------------------------------------
-- Storage: bucket público para os logos (upload só pelo servidor).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Expiração diária das comandas vazias (00:05 em São Paulo = 03:05 UTC).
-- Usa pg_cron se estiver disponível. Mesmo sem ele, a comanda vazia do
-- dia anterior é expirada quando o cliente tenta abrir uma nova.
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expirar-comandas-vazias', '5 3 * * *',
                        'select public.expirar_comandas_vazias(null)');
exception when others then
  raise notice 'pg_cron indisponível (%). Ative em Database > Extensions e rode o cron.schedule manualmente.', sqlerrm;
end $$;
