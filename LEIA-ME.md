# Lotes e validade — SMO/SAOP

Controle de lotes, validade e movimentação de material do GBAPH/CBMPE.
Aplicativo web com login por militar, instalável no celular, com os dados
num banco de verdade.

Leva cerca de 30 minutos para colocar no ar. Não precisa saber programar —
os passos são copiar, colar e clicar.

---

## Como isto funciona

São duas metades, e é importante entender por que não dá para ter só uma.

**O site** (estes arquivos) é só a tela. Pode ficar no GitHub Pages de graça,
porque não guarda nada. É o que abre no navegador do celular.

**O banco** (Supabase) guarda os dados e decide quem pode o quê. É ele que
tem o login, os saldos e as fotos.

Site sozinho não serve: GitHub Pages entrega arquivo estático, sem servidor.
Qualquer senha escrita dentro do site seria enfeite, porque o código fica
visível para quem abrir a página. As regras de acesso deste sistema rodam
dentro do banco, onde ninguém alcança pelo navegador.

---

## Passo 1 — Criar o banco

1. Entre em `supabase.com` e crie uma conta. O plano gratuito atende bem
   o volume da seção.
2. **New project**. Dê um nome (ex.: `smo-lotes`), escolha a região
   **South America (São Paulo)** e defina a senha do banco.
   Guarde essa senha: ela não é a sua senha de login no aplicativo, é a do
   banco, e você vai precisar dela se um dia quiser restaurar um backup.
3. Espere terminar de criar, uns dois minutos.

## Passo 2 — Montar as tabelas

1. No menu da esquerda, **SQL Editor** → **New query**.
2. Rode os quatro arquivos **na ordem**, um por vez. Para cada um: abra o
   arquivo, copie tudo, cole e clique em **Run**.

| Arquivo | O que faz |
|---|---|
| `sql/01-banco.sql` | tabelas de estoque, papéis, regras de acesso, baixa FEFO |
| `sql/02-dados.sql` | os 86 itens da seção, 32 locais, 28 lotes de exercício |
| `sql/03-modulos.sql` | equipamentos, manutenção, pedidos, missões e o painel |
| `sql/04-equipamentos.sql` | os 113 equipamentos reais: 40 DEA, material da SMO, desencarceradores |

O Supabase avisa que o script tem "operações destrutivas". É normal: são os
`drop policy` e `drop trigger` que permitem rodar o arquivo de novo sem erro.
Nenhuma tabela nem lançamento é apagado. Pode confirmar.

Confira rodando isto:

```sql
select
  (select count(*) from public.itens)        as itens,        -- 86
  (select count(*) from public.locais)       as locais,       -- 32
  (select count(*) from public.lotes)        as lotes,        -- 28
  (select count(*) from public.equipamentos) as equipamentos; -- 113
```

Os dois arquivos podem ser executados de novo sem estragar nada.

## Passo 3 — Pegar as duas chaves

**Project Settings** → **Data API**. Copie:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public** — um texto longo começando em `eyJ...`

Abra `config.js` e cole nos dois lugares indicados.

> A chave **anon** é pública de propósito: ela só diz qual projeto é o seu.
> Quem protege os dados são as regras dentro do banco. Pode subir no GitHub.
>
> Já a chave **service_role**, na mesma tela, ignora todas as regras.
> Ela nunca entra neste projeto, nem no GitHub, nem em mensagem de WhatsApp.

## Passo 4 — Publicar o site

1. No GitHub, crie um repositório (ex.: `smo-lotes`).
2. Suba **todos** os arquivos da pasta, mantendo a estrutura:
   `index.html`, `config.js`, `app.js`, `graficos.js`, os cinco `mod-*.js`,
   `sw.js`, `manifest.webmanifest`, e as pastas `img/` e `sql/`.
   Faltando um dos `mod-*.js`, a aba correspondente some sem avisar.
3. **Settings** → **Pages** → em Source escolha **Deploy from a branch**,
   branch `main`, pasta `/ (root)` → **Save**.
4. Depois de um ou dois minutos o endereço aparece nessa mesma tela:
   `https://SEU-USUARIO.github.io/smo-lotes/`

## Passo 5 — Primeiro acesso e sua promoção

1. Abra o endereço, vá em **Primeiro acesso**, informe nome de guerra,
   e-mail e senha.
2. Toda conta nova nasce como **consulta** — vê tudo, não mexe em nada.
   Ninguém se promove sozinho, nem por dentro do aplicativo.
3. Para virar chefe, no Supabase: **Table Editor** → tabela `perfis` →
   ache sua linha → troque `papel` de `consulta` para `chefe` → salve.
4. Recarregue a página. Os botões de registro ficam ativos.

Daí em diante é você quem promove os demais, na mesma tela.

| Papel      | Pode |
|------------|------|
| `consulta` | ler tudo |
| `operador` | registrar entrada, baixa, descarte, foto e item novo |
| `chefe`    | tudo acima, mais ajuste por contagem física e gestão de militares e locais |

## Passo 6 — Fechar a porta

Enquanto o cadastro estiver aberto, qualquer pessoa com o endereço pode
criar conta de consulta e ver o inventário da unidade. Depois que a seção
inteira estiver registrada:

**Authentication** → **Sign In / Providers** → **Email** → desligue
**Allow new users to sign up**.

A partir daí, militar novo você cria em **Authentication** → **Users** →
**Add user**.

Se quiser agilizar o cadastro inicial da tropa, na mesma tela dá para
desligar **Confirm email** — aí a conta já entra sem passar pelo e-mail.

## Passo 7 — Instalar no celular

Abra o endereço no Chrome do Android ou no Safari do iPhone e escolha
**Adicionar à tela de início**. Fica com ícone próprio e abre sem barra de
navegador, como aplicativo.

---

## O que este sistema faz que a planilha não fazia

**Baixa pela validade mais próxima.** Você informa item e quantidade; o
banco decide de quais lotes tirar, começando pelo que vence antes, e devolve
na tela de quais lotes saiu. Lote vencido não entra nessa conta — ele só sai
pelo descarte, com registro próprio.

**Dois militares ao mesmo tempo não se atropelam.** A baixa roda dentro de
uma transação que tranca as linhas do lote. Se dois lançarem no mesmo
segundo, o segundo espera o primeiro e enxerga o saldo já atualizado. Na
planilha compartilhada, os dois sobrescreviam o mesmo número.

**Movimentação não se apaga.** A tabela tem gatilho que recusa alteração e
exclusão. Errou? Lança um AJUSTE, que fica registrado ao lado do erro. É o
que dá valor de prova ao histórico numa auditoria — e é impossível de
garantir numa planilha, onde qualquer um edita qualquer célula.

**Regra no servidor, não na tela.** Esconder um botão não protege nada.
Aqui as tabelas de saldo não aceitam escrita direta de ninguém: todo caminho
passa pelas funções, que conferem o papel antes de gravar.

**Leitura do código da caixa.** Material de saúde costuma trazer GS1
DataMatrix, que carrega produto, lote e validade na mesma etiqueta. O botão
dourado abre a câmera e preenche os três campos. Código novo, o aplicativo
pergunta de qual item é e aprende — na próxima caixa daquele produto, já vem
sozinho.

Funciona no Chrome do Android. O Safari do iPhone ainda não tem essa API;
lá o botão avisa e abre o formulário para digitar.

**Atualização ao vivo.** Quem estiver com a tela aberta vê o lançamento do
outro em poucos segundos, sem recarregar.

**Coluna Planilha.** Fica ao lado do saldo por lote, com a diferença em
vermelho. Enquanto os dois números não fecharem, aquele item não terminou
de migrar. É a régua da transição.

---

## Quando algo der errado

**Tela dizendo "Falta configurar"** — `config.js` está sem as chaves, ou não
está na mesma pasta do `index.html`.

**"URL do projeto parece errada" ou "Invalid path specified in request URL"** —
o `SUPABASE_URL` está torto. O erro mais comum é ter colado o endereço da barra
do navegador (`supabase.com/dashboard/project/…`) em vez do **Project URL**, que
fica em **Project Settings → Data API** e tem a forma
`https://SEU-PROJETO.supabase.co`. Barra no fim ou um `/auth/v1` colado junto
também quebram. Corrija no `config.js` e recarregue.

**"Não deu para carregar os dados"** — o `sql/01-banco.sql` não rodou até o
fim. Rode de novo e veja se aparece erro no SQL Editor.

**Botões apagados depois de entrar** — seu papel ainda é `consulta`.
Passo 5, item 3.

**"Seu perfil não registra entrada"** — o mesmo caso, agora barrado pelo
banco em vez da tela. É o comportamento correto.

**Foto não sobe** — confira se o `bucket` `fotos-itens` apareceu em
**Storage**. Ele é criado na seção 9 do `01-banco.sql`.

**Mudei o app.js e o celular mostra a versão velha** — o service worker
guardou a anterior. Feche e reabra o aplicativo, ou troque `smo-lotes-v1`
por `smo-lotes-v2` na primeira linha do `sw.js`.

---

## Limpar os lotes de exercício

Quando a seção terminar de treinar e for começar a carga real:

```sql
delete from public.movimentos;
delete from public.lotes;
```

Os itens e os locais continuam. O histórico volta a zero.

---

## As cinco abas

**Painel.** A primeira tela. Cada cartão responde a uma pergunta que gera
ação, e clicar leva direto à lista que resolve aquilo. O seletor de período
recalcula consumo, destino e movimentação sobre 30 dias, 90, 6 meses ou 1 ano.

A tabela de **prioridade de reposição** é a peça de decisão: cruza saldo,
estoque ideal e ritmo de consumo dos últimos 90 dias para dizer em quantos
dias cada item zera. Ordenada pela urgência, ela é a base pronta do próximo
pedido — e sai em CSV para anexar ao processo.

**Estoque.** Lotes, validade, baixa FEFO, descarte, foto e leitura do código
da caixa. É a fatia que você já conhece.

**Equipamentos.** Os 113 itens de patrimônio: 40 DEA, o material operacional
da SMO e os desencarceradores. Cada um tem situação, local, histórico de
manutenção e periodicidade de inspeção.

A periodicidade é o mecanismo que unifica três rotinas diferentes: DEA testa
a cada 7 dias, extintor recarrega a cada 365, desencarcerador confere a cada
180. Ao registrar uma inspeção, a próxima é agendada sozinha e o resultado
entra no histórico. Abrir manutenção tira o equipamento de operação na mesma
transação, e ele só volta quando alguém concluir dizendo o que foi feito.

**Pedidos.** O ciclo do processo até o material entrar no estoque. O
recebimento parcial é o ponto: cada chegada vira lote de verdade, com
validade e nota fiscal, e a situação do pedido anda sozinha para parcial ou
concluído. Ninguém digita isso à mão — no banco, `parcial` e `concluído` são
recusados se alguém tentar.

**Missões do dia.** A aba que a tropa abre de manhã. Dia, turno, prioridade,
o que precisa ser feito e quem está designado. A tira de dias no topo mostra
a semana inteira com a contagem de cada dia.

---

## O que mudou desde a primeira versão

Se você já tinha a versão de lotes no ar, **não precisa refazer nada**. Os
arquivos `03` e `04` são aditivos: criam as tabelas novas sem tocar nas
antigas. Rode os dois, suba os arquivos novos e recarregue.

Três coisas foram corrigidas no caminho, todas achadas durante a construção:

- Um seletor de CSS alcançava as células da tabela de lotes e zerava o
  espaçamento, deixando a data de entrada colada na nota fiscal.
- O rótulo "hoje" do horizonte de validade nascia em cima da contagem da
  faixa de 30 dias.
- No celular, sem cabeçalho de tabela, os números apareciam sem dizer o que
  eram. Agora cada um vem rotulado.

---

## Os seis pedidos originais

| Pedido | Onde está |
|---|---|
| Foto de cada item | Estoque — botão "Tirar foto" ao abrir o item |
| Controle de lotes e validade | Estoque — a aba inteira |
| Controle de manutenção da SMO | Equipamentos |
| Missões do dia | Missões do dia |
| Cadastro fácil de item novo | Estoque — botão "Item novo", um formulário só |
| Pedidos com baixa conforme chegam | Pedidos — botão "Receber" em cada item |

Além disso, e porque ajudavam: painel de decisão com projeção de
esgotamento, leitura do código GS1 da caixa, inspeção periódica com
agendamento automático, instalação no celular, atualização ao vivo entre
militares e brasões do CBMPE e do GBAPH.
