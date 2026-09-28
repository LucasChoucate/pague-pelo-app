# Roteiro de demonstração (≈ 5 minutos)

**Preparação:** app rodando (`npm run dev` ou deploy) com o seed aplicado. Abra 3 janelas lado a lado, cada uma numa janela anônima ou num navegador diferente (cada uma precisa da sua sessão):

| Janela | Quem | Login | Tela |
|---|---|---|---|
| A (celular ou modo mobile do DevTools) | Cliente | `cliente@exemplo.com` | — |
| B (tablet ou janela larga) | Atendente | `caixa.garfo@exemplo.com` | `/caixa` |
| C | Porteiro | `porteiro.garfo@exemplo.com` | `/porteiro` |

Senha de todos: `demo1234`. Sem câmera? Use os códigos alternativos em cada passo.

---

### 1. Entrada (cliente, janela A)
- Abra `/entrar?loja=garfo-de-ouro`: é para onde aponta o QR fixo da porta.
- Mostre a tela de boas-vindas com a **cor dourada do Garfo de Ouro** e o preço do kg.
- *Já tenho conta* → login → **Pegar minha comanda**.

### 2. Comanda (cliente)
- Aparece o **QR grande** e o **código curto** (ex.: `A7K2`).
- Fale da regra: tente voltar em `/entrar?loja=sabor-da-serra` e mostre que o botão fica bloqueado ("você já tem uma comanda ativa").

### 3. Pesagem (atendente, janela B)
- *Escanear comanda* (ou *Digitar código* com o código da janela A).
- Digite **450** g → *Lançar pesagem*. **Na janela A o item aparece na hora**, sem recarregar: 450 g × R$ 69,90 = **R$ 31,46**.
- Toque em **Suco natural**. O total sobe na janela A.
- Mostre a correção: lápis na pesagem → 500 g. Fica registrado na auditoria.

### 4. Pagamento (cliente)
- *Pagar* → **Pix** → *Gerar Pix* → **Simular pagamento aprovado**.
- Comprovante → *Mostrar Passe de Saída*.

### 5. Um café depois de pagar (atendente → cliente)
- Na janela B, toque em **Café expresso**.
- Na janela A o passe some: **"Pague a diferença de R$ 6,00"**. Pague com **Cartão** (`4111 1111 1111 1111`, validade futura, CVV `123`).
  - Para mostrar a recusa: cartão terminado em `0002`.

### 6. Saída (cliente → porteiro, janela C)
- No **Passe de Saída**, destaque o QR que **muda a cada 30 s**, a barra de contagem, o relógio ao vivo e o código de 6 dígitos.
- Na janela C, escaneie o QR ou digite o código → tela cheia **verde "Saída liberada"** com nome, valor e horário.
- Valide o mesmo código de novo → **vermelho "Passe já utilizado"**.
- Extra: tire um print do passe, espere o código trocar (a barra zerar) e valide o print → **"Passe expirado"**.

### 7. NPS (cliente)
- A janela A vai sozinha para a pesquisa **"De 0 a 10…"**. Envie a nota.
- De volta ao início, o cliente já pode pegar uma nova comanda.

### 8. Painel do gerente (`gerente.garfo@exemplo.com`)
- **Indicadores:** adoção, tempo médio de saída, inadimplência e NPS comparados com as metas, com 7 dias de histórico do seed. *Baixar CSV*.
- **Comandas:** filtro por data e status, e cancelamento com justificativa.
- **Marca:** troque a cor por um amarelo claro (`#FACC15`) e mostre o aviso de contraste. Imprima o **QR da entrada**.
- **Multi-restaurante:** entre como `gerente.serra@exemplo.com` e mostre que ele não vê nada do Garfo de Ouro.
