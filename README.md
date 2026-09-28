# Pague pelo App

Comanda digital para restaurantes a quilo. O cliente pega a comanda pelo celular, acompanha a pesagem em tempo real, paga por Pix ou cartão e sai mostrando um **Passe de Saída** na porta, sem fila no caixa. Um único sistema atende vários restaurantes; o **Garfo de Ouro** é o piloto.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, Storage) · `html5-qrcode` (leitura de QR) · `qrcode` (geração) · PWA instalável.

> **Pagamento simulado.** Pix e cartão são fictícios nesta versão e nenhum valor real é cobrado. A camada de pagamento fica isolada em `src/lib/pagamentos/` para trocar por Mercado Pago, Pagar.me, Efí etc.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Configuração passo a passo](#2-configuração-passo-a-passo)
3. [Logins de teste](#3-logins-de-teste)
4. [Todos os comandos](#4-todos-os-comandos)
5. [Banco de dados: criar, migrar, limpar e zerar](#5-banco-de-dados-criar-migrar-limpar-e-zerar)
6. [Testes](#6-testes)
7. [Testar no celular](#7-testar-no-celular)
8. [Deploy na Vercel](#8-deploy-na-vercel)
9. [Como o app funciona](#9-como-o-app-funciona)
10. [Segurança](#10-segurança)
11. [Estrutura do projeto](#11-estrutura-do-projeto)
12. [Problemas comuns](#12-problemas-comuns)
13. [Antes de ir para produção](#13-antes-de-ir-para-produção)

---

## 1. Início rápido

Para quem já tem um projeto no Supabase:

```bash
cp .env.example .env.local      # preencha as 5 variáveis (seção 2.3)
npm install
npm run db:schema               # cria tabelas, regras e funções no banco
npm run seed                    # restaurantes, itens, logins de teste e 7 dias de histórico
npm run dev                     # http://localhost:3000
```

Roteiro de apresentação em 5 minutos: [DEMO.md](DEMO.md).

---

## 2. Configuração passo a passo

### 2.1 Pré-requisitos

- **Node.js 20.9 ou mais novo.** Confira com `node -v`.
- Uma conta grátis no [Supabase](https://supabase.com).

### 2.2 Criar o projeto no Supabase

1. Em supabase.com, clique em **New project**.
2. Dê um nome e crie uma **senha do banco**. **Anote a senha**, ela vai no `DATABASE_URL`.
3. Região: **South America (São Paulo)**.
4. Em **Security**, deixe **Enable Data API** marcado. As outras duas opções ("Automatically expose new tables" e "Enable automatic RLS") podem ficar como quiser: o `schema.sql` define as permissões e liga o RLS por conta própria.

### 2.3 Preencher o `.env.local`

Copie o modelo com `cp .env.example .env.local` e preencha:

| Variável | Onde achar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | *Project Settings → Data API → Project URL* | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *Project Settings → API Keys*: **Publishable key** (`sb_publishable_…`) ou a legada **anon** | Pública, pode ir para o navegador. |
| `SUPABASE_SERVICE_ROLE_KEY` | Mesma tela: **Secret key** (`sb_secret_…`) ou a legada **service_role** | **Secreta.** Só no servidor, nunca em commit. |
| `QR_TOKEN_SECRET` | Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Assina os QR Codes. Mínimo de 32 caracteres. |
| `DATABASE_URL` | Botão **Connect** no topo do projeto → *Connection String* | Só para os scripts `db:*` locais. **Não vai para a Vercel.** Troque `[YOUR-PASSWORD]` pela senha, sem colchetes. |

O `.env.local` já está no `.gitignore`.

### 2.4 Criar o banco

Escolha **uma** das opções:

- **Pelo terminal (recomendado):** `npm run db:schema`
- **Pelo painel:** *SQL Editor → New query*, cole todo o [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

O script cria tabelas, funções de negócio, políticas de acesso (RLS), Realtime, o bucket de logos e o agendamento diário (`pg_cron`). Rode-o só em banco **novo**; mudanças posteriores entram por migração (seção 5.2).

### 2.5 Popular e rodar

```bash
npm install
npm run seed        # ou: npm run seed -- --sem-historico  (sem as métricas inventadas)
npm run dev
```

Abra **http://localhost:3000**.

---

## 3. Logins de teste

Criados pelo `npm run seed`. **A senha de todos é `demo1234`.**

| Papel | Login | Abre em |
|---|---|---|
| Cliente | `cliente@exemplo.com` | `/app` |
| Cliente 2 (usado pelo `test:e2e`) | `cliente2@exemplo.com` | `/app` |
| Atendente de caixa: Garfo de Ouro | `caixa.garfo@exemplo.com` | `/caixa` |
| Porteiro: Garfo de Ouro | `porteiro.garfo@exemplo.com` | `/porteiro` |
| Gerente: Garfo de Ouro | `gerente.garfo@exemplo.com` | `/gerente` |
| Atendente / Porteiro / Gerente: Sabor da Serra | `caixa.serra@…`, `porteiro.serra@…`, `gerente.serra@exemplo.com` | |
| Admin da plataforma | `admin@exemplo.com` | `/admin` |

O seed também cria:
- **Garfo de Ouro:** cor dourada, R$ 69,90/kg, 8 itens avulsos.
- **Sabor da Serra:** cor roxa, R$ 59,90/kg, 5 itens avulsos.
- Seis clientes "antigos" (`historico1…6@exemplo.com`) e **7 dias de histórico**, para os painéis não começarem vazios.

O seed pode ser rodado mais de uma vez: ele reaproveita o que já existe e só cria o histórico se o restaurante ainda não tiver comandas.

Para testar vários papéis ao mesmo tempo, use uma **janela anônima ou um navegador diferente para cada login**, porque cada um precisa da sua própria sessão.

---

## 4. Todos os comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o app em modo desenvolvimento (http://localhost:3000). |
| `npm run build` | Gera a versão de produção. |
| `npm run start` | Roda a versão de produção gerada pelo `build`. |
| `npm run seed` | Cria restaurantes, itens, logins de teste e 7 dias de histórico. |
| `npm run seed -- --sem-historico` | O mesmo, **sem** as métricas inventadas. |
| `npm run db:schema` | Aplica o `supabase/schema.sql` num banco novo. Se o banco já tiver as tabelas, não faz nada. |
| `npm run db:migrar -- <arquivo.sql>` | Aplica uma migração. Ex.: `npm run db:migrar -- supabase/migracoes/002_exclusoes.sql` |
| `npm run db:limpar` | **Só mostra** o que seria apagado. Nada é apagado. |
| `npm run db:limpar -- --confirmar` | Apaga o **movimento** (comandas, pagamentos, saídas, NPS, auditoria, métricas). Mantém restaurantes, itens e contas. |
| `npm run db:limpar -- --tudo --confirmar` | **Zera tudo**, menos as contas de admin da plataforma. |
| `npm run test:db` | Testa as regras do banco num Postgres embutido. Não precisa de Supabase. |
| `npm run test:e2e` | Testa a jornada completa no servidor rodando + Supabase. |
| `npm run typecheck` | Checa os tipos TypeScript. |
| `npm run lint` | Roda o ESLint. |

Os comandos `db:*` usam o `DATABASE_URL`; `seed` e `test:e2e` usam as chaves do Supabase. Todos leem o `.env.local`.

---

## 5. Banco de dados: criar, migrar, limpar e zerar

### 5.1 Banco novo

`npm run db:schema` (ou cole o `schema.sql` no SQL Editor). O `schema.sql` sempre representa o **estado final** do banco, já com todas as migrações incluídas.

### 5.2 Migrações

Um banco criado com uma versão antiga do `schema.sql` recebe as mudanças pelas migrações em [`supabase/migracoes/`](supabase/migracoes/), **em ordem numérica**:

```bash
npm run db:migrar -- supabase/migracoes/002_exclusoes.sql
```

| Migração | O que muda |
|---|---|
| `002_exclusoes.sql` | Permite excluir item avulso já usado em comanda, excluir funcionário (`usuarios.excluido_em`) e excluir restaurante (`excluir_dados_restaurante`). |

As migrações podem ser reaplicadas sem erro. Ao criar uma nova, numere na sequência (`003_…`), atualize também o `schema.sql` e acrescente uma linha na tabela acima.

### 5.3 Limpar e zerar

Rode primeiro **sem** `--confirmar` para ver a contagem do que seria apagado. **A exclusão é permanente.**

| Situação | Comandos |
|---|---|
| Tirar as métricas inventadas e os testes, mas manter restaurantes, cardápio e logins | `npm run db:limpar -- --confirmar` |
| Deixar o banco como um cliente real receberia (sem nenhum restaurante) | `npm run db:limpar -- --tudo --confirmar` |
| Zerar e recriar só os dados de exemplo, **sem** métricas | `npm run db:limpar -- --tudo --confirmar` e depois `npm run seed -- --sem-historico` |
| Zerar e recriar tudo, **com** métricas | `npm run db:limpar -- --tudo --confirmar` e depois `npm run seed` |

Depois do `--tudo`, entre como `admin@exemplo.com`, cadastre o restaurante e o gerente em `/admin`; o gerente cria a equipe em `/gerente/equipe`. Se não houver nenhum admin, rode `npm run seed` ou crie um no SQL Editor (seção 12).

**Recomeçar do zero absoluto** (inclusive tabelas e funções): no Supabase, *Project Settings → General → Delete project*, crie outro projeto e refaça a seção 2.

---

## 6. Testes

### 6.1 Regras do banco: `npm run test:db`

Executa o `schema.sql` num Postgres embutido (PGlite), que imita o Supabase, e confere **45 regras**. Entre elas:
- **Acesso por papel e restaurante (RLS):** cada perfil só vê o que é seu.
- **Uma comanda ativa por conta.**
- **Cálculo da pesagem:** 450 g × R$ 69,90 = R$ 31,46.
- **Pagamento da diferença** e NPS.
- **Cancelamento e expiração.**
- **Auditoria.**
- **Exclusões.**

Não precisa de internet nem de Supabase.

### 6.2 Jornada completa: `npm run test:e2e`

Com `npm run dev` rodando em outro terminal e o seed aplicado, testa **51 pontos** no Supabase real:
- **Comanda e caixa:** QR assinado, caixa, tempo real.
- **Pagamento:** Pix e cartão, com recusa e pagamento da diferença.
- **Saída:** passe vencido, código inválido, saída liberada e uso único.
- **Gestão:** exclusão de item, de funcionário e de restaurante.
- **Páginas:** todas as telas.

- Leva cerca de 1 minuto, porque espera um código de saída vencer.
- Usa `cliente2@exemplo.com` e deixa 1 comanda finalizada dele; o resto dos dados de teste é criado e apagado na hora.
- Para testar o site publicado: `BASE_URL=https://seu-app.vercel.app npm run test:e2e`.

---

## 7. Testar no celular

A câmera do navegador só funciona em **HTTPS** (ou em `localhost`). Há três caminhos:

- **Deploy na Vercel (recomendado):** seção 8. O link já sai com HTTPS.
- **Túnel a partir do seu PC:** com `npm run dev` rodando, rode `npx cloudflared tunnel --url http://localhost:3000` (ou `npx ngrok http 3000`) e abra no celular o link `https://…` que aparecer.
- **Sem câmera:** tudo funciona pelos códigos alternativos: o código de 4 caracteres da comanda (no caixa) e o código de 6 dígitos do passe (no porteiro).

Para "instalar" como app: no celular, abra o site e escolha **Adicionar à tela inicial**.

---

## 8. Deploy na Vercel

### 8.1 Pelo terminal (Vercel CLI)

```bash
npx vercel login            # abre o navegador para você entrar
npx vercel link             # cria/vincula o projeto na sua conta
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add QR_TOKEN_SECRET production
npx vercel --prod           # publica e mostra o link
```

Cada `env add` pede o valor: cole o mesmo do `.env.local`. **Não cadastre o `DATABASE_URL`**, que só serve para os scripts locais.

### 8.2 Pelo GitHub

1. Suba o código para um repositório (de preferência **privado**).
2. Na Vercel: *Add New → Project* e importe o repositório.
3. Em *Environment Variables*, cadastre as mesmas 4 variáveis da seção 8.1.
4. Clique em **Deploy**. Cada novo `git push` publica sozinho.

### 8.3 Depois do deploy

1. No Supabase: *Authentication → URL Configuration → Site URL*. Coloque o endereço da Vercel (`https://seu-app.vercel.app`).
2. Entre como gerente → **Marca** → imprima o **QR Code da entrada**. Ele aponta para `https://seu-app.vercel.app/entrar?loja=<slug>`.
3. Opcional: rode `BASE_URL=https://seu-app.vercel.app npm run test:e2e` para testar o site publicado.

O painel de desenvolvimento do Next.js (a bolinha "N" no canto da tela) só aparece no `npm run dev` e **não existe na versão publicada**.

---

## 9. Como o app funciona

### 9.1 Perfis

| Perfil | Quem cria a conta | O que faz |
|---|---|---|
| **Cliente** | Ele mesmo, em `/cadastro` | Pega a comanda, acompanha, paga, sai e avalia. Uma conta serve para todos os restaurantes. |
| **Atendente de caixa** | Gerente | Escaneia a comanda, lança pesagem e itens avulsos, corrige ou remove itens. |
| **Porteiro** | Gerente | Valida o Passe de Saída. |
| **Gerente** | Admin da plataforma | Vê os indicadores e as comandas; gerencia equipe, preço do kg, itens avulsos, logo e cor. |
| **Admin da plataforma** | Seed ou SQL | Cadastra, ativa, desativa e exclui restaurantes. |

### 9.2 Jornada do cliente

1. **Entrada:** escaneia o QR da porta (`/entrar?loja=<slug>`), entra ou cria conta e toca em **Pegar minha comanda**.
2. **Comanda:** mostra o QR (token assinado) e o código curto (ex.: `A7K2`). Só **1 comanda ativa por conta**, em qualquer restaurante.
3. **Consumo:** cada lançamento do caixa aparece na hora na tela do cliente (Supabase Realtime).
4. **Pagamento:** Pix simulado (QR, copia e cola e botão "Simular pagamento aprovado") ou cartão simulado. Gera comprovante.
5. **Item depois de pagar:** se o caixa lançar um café depois do pagamento, a comanda volta a ter **saldo pendente** e o cliente paga só a diferença.
6. **Saída:** o Passe de Saída tem QR e código de 6 dígitos que **mudam a cada 30 s**, com relógio ao vivo, barra de contagem, nome e valor pago. Vale **uma vez**.
7. **Depois da saída:** pesquisa NPS de 0 a 10, e o cliente já pode abrir outra comanda numa próxima visita.

Cartões de teste: qualquer número de 16 dígitos com validade futura é aprovado. Com final **0002**, o cartão é recusado; com final **0003**, dá saldo insuficiente.

### 9.3 Estados da comanda

```
ABERTA → PENDENTE_PAGAMENTO → PAGA → FINALIZADA
                    ↑           │
                    └───────────┘  (novo item depois de pagar)
```

- **CANCELADA:** só o gerente cancela, com justificativa.
- **EXPIRADA:** comanda aberta e sem itens, no fim do dia. O `pg_cron` roda às 00h05 de Brasília; se ele não estiver ativo, a comanda expira quando o cliente tenta abrir outra.

### 9.4 Validação na porta

| Resultado | Quando |
|---|---|
| 🟢 **Saída liberada** | Comanda paga e o QR ou código que está na tela **agora**. Quando o código troca, o anterior vira "expirado" na hora. |
| 🔴 Comanda com saldo pendente de R$ X | Houve lançamento depois do pagamento. |
| 🔴 Passe expirado | QR ou código de uma janela que já venceu (print, foto). |
| 🔴 Passe já utilizado | A saída dessa comanda já foi validada. |
| 🔴 Passe de outro restaurante | O QR foi gerado em outro restaurante. |
| 🔴 Código inválido / Passe inválido | Código que não existe, ou QR que não é de um passe. |

As cores de status são fixas e iguais em todos os restaurantes. Cada validação grava o horário e o tempo de saída.

### 9.5 Painel do gerente (`/gerente`)

- **Indicadores**, comparados com as metas, com filtro por período e botão **Baixar CSV**:

  | Indicador | Meta | Como é calculado |
  |---|---|---|
  | Adoção do app | ≥ 60% | Comandas pagas pelo app ÷ (pagas pelo app + clientes do caixa tradicional). O gerente informa, no próprio painel, quantos clientes pagaram no caixa comum em cada dia. |
  | Tempo médio de saída | < 30 s | Da leitura do passe até a liberação. |
  | Inadimplência | < 0,5% | Comandas de dias já encerrados que ficaram com saldo ÷ comandas com consumo. |
  | NPS | ≥ 75 | % de notas 9–10 menos % de notas 0–6. |

- **Comandas:** filtro por data e status, e cancelamento com justificativa.
- **Equipe:** criar, desativar/reativar e **excluir** atendentes e porteiros. Excluir bloqueia o login e libera o e-mail para uma conta nova; o nome continua no histórico.
- **Preços e itens:** preço do kg (vale para as próximas pesagens) e itens avulsos com ícone em **emoji**. Os itens podem ser editados, desativados e **excluídos**; as comandas antigas mantêm o nome e o valor cobrado.
- **Marca:** nome, **cor de destaque** (com verificação de contraste WCAG AA: se a cor não passar, é usada a cor padrão), **logo** (PNG, JPG, WEBP ou SVG até 1 MB) e o **QR Code da entrada** para imprimir.

### 9.6 Admin da plataforma (`/admin`)

Cadastra restaurante e primeiro gerente, e ativa ou desativa restaurantes. Também **exclui** restaurante: é preciso **digitar o nome** para confirmar, e todas as comandas, pagamentos, avaliações, itens, contas da equipe e o logo são apagados para sempre.

### 9.7 Identidade visual

- **Paleta:** verde-azulado `#0F766E` como cor principal e coral `#FF6B4A` como destaque. Tem modo escuro automático.
- **Tokens:** todas as cores ficam como variáveis em [`src/app/globals.css`](src/app/globals.css). Para trocar a paleta, edite só esse arquivo.
- **Cor do restaurante:** aparece só na tela de boas-vindas e numa faixa fina no topo da comanda. Pagamento, passe e status sempre usam as cores do Pague pelo App.

---

## 10. Segurança

- **RLS em todas as tabelas:** o cliente vê só a própria comanda, e o funcionário só vê o próprio restaurante. O navegador não consegue escrever direto em nenhuma tabela.
- **Toda escrita passa pelo servidor**, por um de dois caminhos:
  - funções `SECURITY DEFINER` no banco, que conferem papel e restaurante (abrir comanda, lançar, corrigir, remover, cancelar, NPS);
  - rotas do Next com a secret key (pagamento, passe, validação, gestão).
- **Valores calculados no servidor:** peso × preço do kg, total e saldo nunca vêm do navegador.
- **QR sem IDs expostos:** os QR são JWT assinados (HS256), e o código de 6 dígitos é um HMAC da comanda com a janela de 30 s. O passe é de uso único: a comanda vira FINALIZADA de forma atômica.
- **Papéis protegidos:** o cadastro público sempre cria **cliente**. Funcionários são criados pelo gerente, sempre no restaurante dele.
- **Auditoria:** lançamentos, correções, remoções, pagamentos, preços, marca, equipe, saídas e exclusões ficam na tabela `auditoria`.
- **LGPD:** coleta mínima, CPF opcional e aceite do [aviso de privacidade](src/app/privacidade/page.tsx) no cadastro.
- **Segredos:** a secret key, o `QR_TOKEN_SECRET` e a senha do banco ficam só no `.env.local` e nas variáveis da Vercel. Se algum vazar, gere outro no Supabase (*API Keys* ou *Database → Reset password*) e atualize os dois lugares.

---

## 11. Estrutura do projeto

```
supabase/
  schema.sql               Banco completo (estado final): tabelas, RLS, funções, Realtime
  migracoes/               Mudanças para bancos já criados (aplicar em ordem)
  teste-regras.mjs         npm run test:db
scripts/
  seed.ts                  npm run seed
  aplicar-schema.mjs       npm run db:schema / db:migrar
  limpar.mjs               npm run db:limpar
tests/
  e2e.mjs                  npm run test:e2e
src/
  proxy.ts                 Renova a sessão do Supabase a cada requisição
  lib/
    tokens.ts              QR assinados e código de 6 dígitos
    pagamentos/            Interface do gateway + implementação simulada
    indicadores.ts         Adoção, tempo de saída, inadimplência, NPS
    cor.ts / emoji.ts      Contraste WCAG; validação de emoji
    useComandaAoVivo.ts    Comanda em tempo real (Realtime)
  app/
    entrar/                Destino do QR da porta (/entrar?loja=slug)
    app/                   Cliente: início, comanda, pagar, comprovante, saída, avaliar, histórico, perfil
    caixa/                 Atendente
    porteiro/              Validação de saída
    gerente/               Indicadores, comandas, equipe, preços e itens, marca
    admin/                 Admin da plataforma
    api/                   Rotas do servidor
public/                    Ícone, service worker e página offline (PWA)
```

---

## 12. Problemas comuns

| Sintoma | Solução |
|---|---|
| Tela "Falta conectar o Supabase" | Falta alguma variável no `.env.local`. Preencha e **reinicie** o `npm run dev`. |
| `db:schema` dá erro de conexão (`ENOTFOUND`, `ENETUNREACH`, timeout) | A conexão *Direct* usa IPv6, que algumas redes não têm. Use a string do **Session pooler** (botão *Connect*). |
| `db:schema` dá "password authentication failed" | Senha errada no `DATABASE_URL`. Tire os colchetes e codifique caracteres especiais (`!` vira `%21`, `@` vira `%40`, `#` vira `%23`). Se esqueceu a senha: *Project Settings → Database → Reset database password*. |
| Login "e-mail/telefone ou senha incorretos" com os logins de teste | Rode `npm run seed`. |
| A câmera não abre | Precisa de HTTPS (seção 7) e da permissão de câmera no navegador. Enquanto isso, use os códigos. |
| A tela do cliente não atualiza sozinha | Confira em *Database → Publications → supabase_realtime* se `comandas`, `itens_comanda` e `pagamentos` estão marcadas (o `schema.sql` já faz isso). Recarregar a página sempre traz o valor certo. |
| O gerente não vê um funcionário | Funcionários excluídos saem da lista; os desativados aparecem com "(desativado)". |
| Não sobrou nenhum admin | No SQL Editor: `update public.usuarios set papel = 'admin_plataforma', restaurante_id = null where email = 'seu@email.com';` (a conta precisa existir; crie em `/cadastro`). |
| As comandas vazias não expiram à meia-noite | Ative o `pg_cron` em *Database → Extensions* e rode o último bloco do `schema.sql`. |

---

## 13. Antes de ir para produção

- Trocar o gateway simulado por um real (ver [`src/lib/pagamentos/gateway.ts`](src/lib/pagamentos/gateway.ts)) e confirmar o Pix por **webhook assinado**, removendo a rota `/api/pagamentos/[id]/simular`.
- Emissão de nota fiscal (NFC-e) e estorno.
- Limite de tentativas (rate limit) no login, no cadastro e na validação de código.
- Login por código SMS, se desejado: ative *Phone Auth* no Supabase. Hoje o telefone vira um e-mail interno (`<numero>@tel.paguepeloapp.local`) e o login é por senha.
- Revisar o aviso de privacidade com um advogado.
- Trocar a senha do banco e a secret key usadas durante os testes.
