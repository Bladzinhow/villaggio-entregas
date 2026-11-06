# Villaggio Paradiso — Controle de Entregas

> **Atalho para amanhã:** se você ainda não rodou nenhuma das migrações 002-005, use o arquivo **`supabase/migration_all_in_one.sql`** — ele já tem tudo junto, é só rodar uma vez só no SQL Editor do Supabase. As instruções detalhadas de cada parte continuam abaixo, caso precise entender o que cada uma faz.

App próprio, construído do zero, para substituir o antigo (que rodava no Base44).
Sem mensalidade — usa apenas os planos gratuitos do Supabase e da Vercel.

Este guia assume que você **nunca fez isso antes**. Vá com calma, uma etapa de cada vez.
Se travar em algum passo, volte na conversa com o Claude e descreva exatamente o que apareceu na tela.

---

## Parte 1 — Criar o banco de dados (Supabase)

1. Acesse **https://supabase.com** e clique em **"Start your project"**. Crie uma conta (pode ser com Google).
2. Clique em **"New project"**.
   - Nome: `villaggio-entregas` (ou o que preferir)
   - Senha do banco: crie uma senha forte e **guarde em um lugar seguro** (ex.: gerenciador de senhas). Você não vai digitar essa senha no app, mas pode precisar dela depois.
   - Região: escolha a mais próxima do Brasil (ex.: `South America (São Paulo)`)
3. Aguarde uns 2 minutos enquanto o Supabase prepara o projeto.
4. No menu à esquerda, clique em **"SQL Editor"**.
5. Clique em **"New query"**.
6. Abra o arquivo `supabase/schema.sql` (está nesta pasta que te entreguei), copie **todo o conteúdo** e cole no editor do Supabase.
7. Clique em **"Run"** (ou Ctrl+Enter). Deve aparecer "Success. No rows returned".
   - Isso cria as tabelas `profiles`, `residents`, `packages` e já configura a segurança (só quem faz login consegue ver os dados — diferente do app anterior).

### Pegar as chaves de conexão

8. No menu à esquerda, clique em **"Project Settings"** (ícone de engrenagem) → **"API"**.
9. Você vai ver dois campos que precisamos:
   - **Project URL** (algo como `https://abcxyz.supabase.co`)
   - **anon public** (uma chave longa de letras e números)
10. Guarde esses dois valores — vamos usar já já.

---

## Parte 2 — Rodar o app no seu computador (teste local)

Isso é opcional, mas ajuda a confirmar que tudo funciona antes de publicar.

1. Instale o **Node.js** (se ainda não tiver): https://nodejs.org (baixe a versão "LTS").
2. Abra o "Terminal" (Mac/Linux) ou "Prompt de Comando"/"PowerShell" (Windows) dentro da pasta do projeto.
3. Rode:
   ```
   npm install
   ```
4. Copie o arquivo `.env.example` e renomeie a cópia para `.env`.
5. Abra o `.env` num editor de texto simples e cole a **Project URL** e a **anon public key** que você pegou no Supabase:
   ```
   VITE_SUPABASE_URL=https://abcxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=coloque-a-chave-aqui
   ```
6. Rode:
   ```
   npm run dev
   ```
7. Abra o link que aparecer (algo como `http://localhost:5173`) no navegador.
8. Clique em **"Criar conta"**, cadastre seu primeiro usuário (esse vai ser você, como porteiro/síndico).
9. Pronto — você já deve ver a tela principal, vazia, esperando a primeira encomenda.

---

## Parte 3 — Publicar de verdade (Vercel)

1. Acesse **https://vercel.com** e crie uma conta (pode ser com GitHub, Google ou e-mail).
2. A forma mais simples de publicar sem usar GitHub é pelo **Vercel CLI**:
   ```
   npm install -g vercel
   vercel login
   vercel
   ```
   Siga as perguntas no terminal (aceite as opções padrão apertando Enter).
3. Quando perguntar sobre variáveis de ambiente, ou depois pelo site da Vercel (**Project → Settings → Environment Variables**), adicione as mesmas duas variáveis do `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Rode `vercel --prod` para publicar a versão final.
5. A Vercel vai te dar um link tipo `villaggio-entregas.vercel.app` — já funcionando na internet.

### Usar seu domínio próprio (entregas.villaggioparadiso.org.br)

Se você ainda tiver acesso ao painel de DNS do domínio (Cloudflare, Registro.br, etc. — isso é separado da conta Base44 perdida):

1. No projeto da Vercel, vá em **Settings → Domains** e adicione `entregas.villaggioparadiso.org.br`.
2. A Vercel vai te mostrar um registro **CNAME** (ou **A**) para configurar no seu provedor de DNS.
3. Adicione esse registro lá. Pode levar de alguns minutos a algumas horas para propagar.

Se você não tiver mais acesso ao DNS também, me avise — nesse caso o app funciona normalmente pelo link `.vercel.app`, só não fica no endereço antigo.

---

## Como usar o dia a dia

- **Criar conta de cada porteiro**: cada funcionário cria a própria conta (nome + e-mail + senha) na tela de login, clicando em "Criar conta". Todos que tiverem conta conseguem ver e registrar encomendas.
- **Cadastrar moradores**: por enquanto, o cadastro de moradores (nome, rua, telefone) é feito diretamente pela tabela `residents` no Supabase (Table Editor). Se quiser, posso construir uma tela dentro do app para isso — foi deixado de fora desta primeira versão para entregar o essencial primeiro.
- **Aviso por WhatsApp**: ao lado de cada encomenda pendente (se o morador tiver telefone cadastrado), aparece o botão "Avisar por WhatsApp" — ele abre o WhatsApp com a mensagem pronta, você só confirma o envio. Não é automático (isso evitaria custo com API paga).
- **Exportar Excel**: baixa a lista filtrada (pendentes/entregues/todos) em uma planilha `.xlsx`.

---

## O que ficou de fora desta primeira versão (posso adicionar depois)

- Tela dentro do app para cadastrar/editar moradores (por ora, via Supabase direto)
- Upload de foto da encomenda
- "Roteiro de entregas" (rota otimizada por rua)
- Papéis diferentes para síndico vs. porteiro (hoje todo mundo logado tem o mesmo acesso)

Me avise qual desses você quer que eu construa a seguir.

---

## Parte 4 — Cadastro pelo entregador (novidade)

Agora existe uma segunda porta de entrada no app, sem necessidade de login:

**`https://SEU-SITE.vercel.app/nova`**

O entregador abre esse link (pelo próprio celular, via QR code, ou num tablet fixo na portaria), preenche os dados da encomenda, e ela cai numa fila de espera — **não vira uma encomenda "de verdade" até o porteiro conferir**.

### Como pegar o link/QR code

1. Logado no app, clique no botão **"Link do entregador"** (ao lado de "Exportar Excel"). Ele copia o link automaticamente.
2. Vá em um gerador de QR code gratuito, por exemplo **qr-code-generator.com** ou **qrcode-monkey.com**, cole o link, gere a imagem, baixe e imprima/plastifique para fixar na guarita.
3. (Opcional, para o futuro) O mesmo link pode ser aberto direto num tablet fixo na portaria — não precisa de nenhuma mudança no app para isso.

### Como o porteiro confere

1. No app, clique na aba **"Conferência"** (mostra quantas estão esperando).
2. Compare o que foi digitado com o pacote físico na mão (peso, tamanho, etc.).
3. Clique em **"Aceitar"** → ela vira uma encomenda pendente normal, e o morador pode ser avisado por WhatsApp.
4. Ou clique em **"Recusar"** → escolha o motivo (peso incompatível, tamanho, endereço não encontrado, item danificado, outro) e confirme. Ela sai da fila e fica registrada como recusada (não aparece mais, mas o histórico fica salvo no banco para consulta futura, se precisar).

### Se você já rodou o `schema.sql` antes

Não precisa rodar tudo de novo. Só rode o arquivo **`supabase/migration_002_submissions.sql`** no SQL Editor do Supabase (mesmo processo: copiar, colar, "Run") — ele adiciona só o que é novo, sem mexer no que já existe.

---

## Parte 5 — Correções de risco (após revalidação do processo)

### Se você já rodou as migrações anteriores

Rode só o arquivo **`supabase/migration_003_pickup_name.sql`** no SQL Editor (mesmo processo de sempre).

### O que mudou

1. **Confirmação de identidade na retirada.** Ao clicar em "Confirmar entrega", agora aparece um campo para anotar o nome de quem está retirando a encomenda antes de confirmar. É opcional (não trava o uso), mas recomendado — fica registrado no histórico e no Excel.
2. **Alerta de código de rastreio duplicado.** Se você (ou o entregador, na Conferência) tentar cadastrar uma encomenda com um código de rastreio que já existe no sistema, aparece um aviso mostrando a encomenda existente, e é preciso confirmar explicitamente antes de continuar — evita duplicidade por engano.

### Memória automática para o entregador

Quando o mesmo entregador cadastra várias encomendas seguidas (ex.: 30 pacotes da mesma transportadora em um dia), o formulário lembra automaticamente do **nome dele, CPF e transportadora** a partir da segunda encomenda em diante — só precisa preencher o que muda a cada pacote (destinatário, rua, rastreio). Essa memória fica salva no navegador/celular de quem está preenchendo (não no banco de dados), então cada entregador tem a própria memória, sem misturar com a de outros.

---

## Parte 6 — Editar, buscar, atraso e ocorrências

### Se você já rodou as migrações anteriores

Rode só o arquivo **`supabase/migration_004_occurrences.sql`** no SQL Editor (mesmo processo de sempre).

### O que foi adicionado

1. **Editar encomenda.** Cada encomenda agora tem um botão "Editar" — corrige qualquer campo digitado errado, sem precisar recadastrar.
2. **Busca.** Um campo de busca acima da lista filtra por nome do destinatário, rua ou código de rastreio, dentro da aba selecionada.
3. **Alerta de encomenda parada.** Um quarto contador, "Atenção (7+ dias)", mostra quantas encomendas pendentes estão há uma semana ou mais na portaria. Cada uma dessas também ganha um selo vermelho "Parada há X dias" no card. O limite de 7 dias está no código (`AGING_THRESHOLD_DAYS` em `src/utils.js`) e pode ser ajustado se quiser um prazo diferente.
4. **Registro de ocorrências.** Botão "Registrar ocorrência" em cada encomenda (avaria, extravio ou outro, com um campo de detalhe). Uma vez registrada, ela aparece destacada em vermelho no card e entra no relatório Excel.

---

## Parte 7 — Fotos das encomendas (prova de recebimento)

### Se você já rodou as migrações anteriores

Rode só o arquivo **`supabase/migration_005_photos.sql`** no SQL Editor. Essa migração também cria o "espaço de armazenamento" (bucket) das fotos dentro do Supabase — não precisa criar nada manualmente antes.

### O que foi adicionado

- Tanto no cadastro manual quanto na tela do entregador (`/nova`), agora existe um campo **"Foto da encomenda"**, opcional. Em celular, ele já abre direto a câmera (`capture="environment"`).
- A foto aparece como miniatura no card da encomenda (inclusive na Conferência, antes de aceitar) — clicando nela, abre em tamanho grande em uma nova aba.
- Se o entregador tirar a foto lá no cadastro dele e o porteiro aceitar na Conferência, a mesma foto já vem junto para a encomenda — não precisa tirar de novo.
- Se o upload da foto falhar por qualquer motivo (sem sinal, por exemplo), o cadastro da encomenda continua funcionando normalmente, só sem a foto — isso nunca trava o registro.
- Tamanho máximo por foto: 5 MB (mais que suficiente para fotos de celular comprimidas).

---

## Parte 8 — Horário de atendimento do entregador

O cadastro pelo link `/nova` agora só funciona em horário útil:
- Segunda a sexta: 7h às 18h
- Sábado: 7h às 14h
- Domingo: fechado

Isso já está incluído no `migration_all_in_one.sql` (ou, separadamente, em `migration_006_business_hours.sql`).

**Importante:** a proteção real está no banco de dados (a regra recusa o cadastro fora do horário mesmo que alguém tente contornar a tela). A mensagem "Fora do horário de atendimento" que aparece na tela é só para ser educado com quem tentar de boa-fé — a segurança de verdade não depende dela.

Se precisar mudar esses horários no futuro, me avise — é uma alteração pequena e rápida.

---

## Parte 9 — Cadastro de moradores pelo próprio app

Não precisa de nenhuma migração nova no banco — as permissões já existiam desde o início.

### O que foi adicionado

- Nova aba **"Moradores"** no painel, com contador de quantos já estão cadastrados.
- Busca por nome, rua ou número.
- Botão **"+ Novo morador"** — cadastra nome, rua, número, telefone e observações.
- Botões **"Editar"** e **"Remover"** em cada morador da lista.

Não é mais necessário usar o Table Editor do Supabase para isso no dia a dia — só use se precisar importar vários de uma vez via CSV (como fizemos com a planilha do Group Software).

**Lembrete:** a rua e o número do morador precisam bater exatamente com o que é digitado no cadastro das encomendas para o botão de WhatsApp aparecer.

---

## Parte 10 — Histórico de conferência (auditoria)

Não precisa de migração nova — os dados recusados/aceitos já estavam sendo salvos no banco desde o início, só não apareciam em nenhuma tela.

### O que mudou

- A aba **Conferência** agora tem sub-abas: **Aguardando**, **Recusadas**, **Aceitas** e **Todas**.
- Nada that é recusado "desaparece" mais — fica registrado com o motivo da recusa e a data/hora, disponível para consulta a qualquer momento.
- Botão **Exportar Excel** dentro da Conferência agora exporta o histórico da sub-aba selecionada (útil para auditoria).

---

## Parte 11 — Papéis de acesso, App instalável (PWA) e Leitor de código de barras

### Se você já rodou as migrações anteriores

Rode só o arquivo **`supabase/migration_007_roles.sql`** no SQL Editor.

### 1. Papéis de acesso (Síndico vs. Porteiro)

- Nova aba **"Equipe"**, mostrando todo mundo que já tem conta, com o papel de cada um.
- Só **síndicos** podem promover/rebaixar outros membros da equipe (botão "Tornar Síndico"/"Tornar Porteiro").
- Só síndicos podem **remover moradores** da lista (porteiros continuam podendo cadastrar/editar).
- **Todo mundo que criar conta pela primeira vez começa como Porteiro** — por segurança, ninguém consegue virar síndico sozinho; precisa que outro síndico já existente promova.

**Importante:** como ainda não existe nenhum síndico cadastrado, o **primeiro** precisa ser promovido direto no Supabase (Table Editor → `profiles` → editar a linha da pessoa → mudar `role` de `porteiro` para `sindico`). Depois disso, essa pessoa já consegue promover as próximas pelo próprio app.

Além disso, agora aparece nos cards **quem da equipe** registrou, confirmou a entrega, ou registrou a ocorrência de cada encomenda — e isso também entra no relatório Excel.

### 2. App instalável (PWA)

O site agora pode ser "instalado" na tela inicial do celular, com ícone próprio e abrindo em tela cheia (sem barra do navegador):

- **Android/Chrome:** abra o site, toque no menu (⋮) → "Instalar aplicativo" ou "Adicionar à tela inicial".
- **iPhone/Safari:** abra o site, toque no ícone de compartilhar (□↑) → "Adicionar à Tela de Início".

Não precisa de nenhuma conta de desenvolvedor nem loja de aplicativos — é gratuito e funciona direto pelo navegador.

### 3. Leitor de código de barras/QR

Um botão **"📷 Escanear código"** foi adicionado ao lado do campo de código de rastreio, tanto no cadastro manual quanto na tela do entregador. Ele abre a câmera do celular e preenche o campo automaticamente ao reconhecer um código de barras ou QR code. Se não conseguir ler, é só digitar manualmente — nunca trava o cadastro.

**Sobre o leitor físico que vocês têm na administração:** leitores de código de barras USB/Bluetooth tradicionais funcionam como um teclado — quando conectados, basta clicar dentro do campo "Código de rastreio" e escanear o código com o leitor; ele "digita" o código sozinho e já devia funcionar sem nenhuma configuração extra. Vale testar!

## Parte 12 — Correção do "congelamento" ao criar conta + recuperação de senha

### O que estava acontecendo

A tela de login "travava" (sem erro, sem sucesso) ao clicar em "Criar conta" porque, por padrão, o Supabase exige **confirmação por e-mail** antes de liberar o login. A conta estava sendo criada normalmente, mas como o app não mostrava nenhuma mensagem sobre isso, parecia que nada tinha acontecido. O mesmo tipo de silêncio acontecia ao tentar cadastrar de novo um e-mail que já tinha conta.

Isso foi corrigido na tela de login, que agora sempre mostra uma mensagem — seja de sucesso, de erro, ou avisando para confirmar o e-mail.

Além disso, foi adicionado um botão **"Recuperar senha"** na tela de login, usando o recurso oficial de recuperação de senha do Supabase.

### Se você já rodou as migrações anteriores

Esta parte é só código do app (frontend) — **não precisa rodar nenhuma migração SQL nova**. Basta atualizar o GitHub/Vercel com os arquivos desta pasta.

### Passo a passo: configurar o Supabase para os e-mails funcionarem

Para os e-mails de confirmação de conta e de recuperação de senha chegarem com o link correto (apontando para o site de vocês, e não para "localhost"), configure uma vez no Supabase:

1. No painel do Supabase, abra o projeto do app.
2. No menu da esquerda, clique em **Authentication**.
3. Clique em **URL Configuration** (ou "Configuração de URL").
4. Em **Site URL**, coloque o endereço do site de produção, por exemplo: `https://entregas-villaggio.vercel.app`
5. Em **Redirect URLs**, adicione (uma por linha, ou clicando em "Add URL"):
   - `https://entregas-villaggio.vercel.app/*`
   - `https://villaggio-entregas-rkd2.vercel.app/*` (o domínio antigo, caso algum link antigo ainda esteja em uso)
6. Clique em **Save**.

Sem esse passo, o link de "Recuperar senha" pode abrir uma página que não existe (ou aponta para `localhost`), mesmo que o e-mail tenha sido enviado corretamente.

### Opcional: desativar a exigência de confirmar e-mail (simplifica o uso interno)

Como este app é usado só pela equipe interna (síndico e porteiros, não pelos moradores), pode valer a pena **desativar** a exigência de confirmação por e-mail, para que criar uma conta já libere o acesso imediatamente, sem precisar abrir e-mail nenhum:

1. No Supabase, vá em **Authentication → Providers**.
2. Clique em **Email**.
3. Desative a opção **"Confirm email"**.
4. Clique em **Save**.

Isso é opcional — o app já funciona bem dos dois jeitos, mostrando a mensagem certa em cada caso. Mas se a equipe achar o passo de confirmar e-mail desnecessário, essa opção remove ele.

### Como usar a recuperação de senha

1. Na tela de login, clique em **"Recuperar senha"**.
2. Digite o e-mail da conta e clique em **"Enviar link de recuperação"**.
3. Abra o e-mail recebido (verifique também a caixa de spam) e clique no link.
4. Uma nova tela abrirá para digitar a nova senha duas vezes.
5. Depois de salvar, a pessoa já entra automaticamente no app com a nova senha.

## Parte 13 — Configurações do síndico, e-mail automático, retirada por link e leitura de etiqueta por IA

Esta parte foi inspirada numa análise comparativa com um concorrente (Chegou Entrega) e adiciona quatro coisas:

1. Uma aba **Configurações** (só síndico edita) para ajustar regras sem precisar mexer em código.
2. **E-mail automático** ao morador quando a encomenda chega (opcional — precisa de uma conta gratuita na Resend).
3. Um **link de retirada** por encomenda, que o morador pode usar para confirmar sozinho que já retirou.
4. **"Preencher com IA"**: tira foto da etiqueta e a IA tenta preencher o formulário sozinha (opcional — precisa de uma conta paga na API da Anthropic, mas o custo é muito baixo — veja a estimativa abaixo).

As três primeiras coisas (Configurações, regras de armazenamento, link de retirada) já funcionam assim que você subir o código — não dependem de nada pago. Só o e-mail automático e a leitura por IA são opcionais e desligados por padrão até você configurar.

### Passo 1 — Rodar a migração no Supabase

Rode **`supabase/migration_008_config_notificacoes_ia.sql`** no SQL Editor do Supabase (ou, se for uma instalação nova, o `migration_all_in_one.sql` atualizado já inclui tudo).

### Passo 2 — Usar o que já funciona sem configuração extra

- Vá na aba **Configurações** (novo item no menu) para ajustar "avisar depois de quantos dias parada" e a mensagem personalizada.
- Em cada encomenda pendente, agora existe um botão **"Copiar link de retirada"** — você pode colar esse link numa mensaga de WhatsApp manual, por exemplo, para o morador confirmar a retirada sozinho pelo celular.
- No cadastro de morador, agora há um campo de **e-mail** (opcional) — vale cadastrar mesmo antes de ligar o envio automático, já deixa pronto para quando ligar.

### Passo 3 (opcional) — Ligar o e-mail automático ao morador

Isso precisa de uma conta na **Resend** (serviço de envio de e-mail, tem plano gratuito de até 3.000 e-mails/mês) e de publicar um Edge Function no Supabase.

1. Crie uma conta gratuita em [resend.com](https://resend.com).
2. **Importante sobre o remetente:** para enviar e-mails de verdade para os moradores (e não só para o seu próprio e-mail de cadastro), a Resend pede para você **verificar um domínio** seu. Como a AMVP já usa o domínio `villaggioparadiso.org.br` (vocês têm o e-mail entregas@villaggioparadiso.org.br), em **Resend → Domains → Add Domain**, adicione `villaggioparadiso.org.br` e siga as instruções para adicionar os registros DNS pedidos — isso provavelmente precisa de quem administra o domínio/hospedagem do site da AMVP. Se não tiver esse acesso agora, pode pular este passo por enquanto; o e-mail só vai conseguir ser testado com o seu próprio e-mail de cadastro na Resend até o domínio ser verificado.
3. Em **Resend → API Keys**, crie uma chave e copie (começa com `re_...`).
4. No Supabase, vá em **Edge Functions** (menu da esquerda) → **Deploy a new function** → **Via Editor**.
5. Dê o nome **`notify-arrival`**, apague o código de exemplo e cole o conteúdo do arquivo `supabase/functions/notify-arrival/index.ts` (está na pasta do projeto). Clique em **Deploy function**.
6. Ainda na área de Edge Functions, procure por **Secrets** (segredos/variáveis de ambiente) e adicione:
   - `RESEND_API_KEY` = a chave que você copiou no passo 3
   - `NOTIFY_FROM_EMAIL` = um e-mail do domínio verificado (ex.: `entregas@villaggioparadiso.org.br`) — se ainda não verificou o domínio, deixe este de fora por enquanto
   - `SITE_URL` = `https://entregas-villaggio.vercel.app`
7. Volte no app, vá em **Configurações** e marque **"Notificar morador por e-mail automaticamente"**, depois **Salvar**.
8. Cadastre o e-mail de pelo menos um morador de teste e registre uma encomenda pendente para esse endereço, para conferir se o e-mail chega.

Se o e-mail não chegar, nenhum cadastro quebra — o app simplesmente não envia nada, como se a função não existisse.

### Passo 4 (opcional) — Ligar a leitura de etiqueta por IA ("Preencher com IA")

Isso precisa de uma conta na **API da Anthropic** — é diferente da sua assinatura do Claude que você usa para conversar aqui: é uma conta separada, pré-paga por uso, em [console.anthropic.com](https://console.anthropic.com).

**Estimativa de custo:** cada foto analisada custa, em média, menos de US$ 0,001 (um décimo de centavo de dólar) usando o modelo Claude Haiku — ou seja, mesmo com 500 encomendas fotografadas por mês, o custo fica abaixo de US$ 0,50/mês (menos de R$ 3). É um custo bem baixo frente ao ganho de tempo, mas exige cadastrar um cartão na Anthropic e acompanhar o consumo.

1. Crie uma conta em [console.anthropic.com](https://console.anthropic.com), adicione um método de pagamento e gere uma chave de API (começa com `sk-ant-...`). **Guarde essa chave com cuidado — nunca cole ela no chat comigo nem em nenhum lugar público.**
2. No Supabase, vá em **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Dê o nome **`scan-label`**, apague o código de exemplo e cole o conteúdo do arquivo `supabase/functions/scan-label/index.ts`. Clique em **Deploy function**.
4. Em **Secrets**, adicione `ANTHROPIC_API_KEY` com a chave gerada no passo 1.
5. Volte no app, vá em **Configurações** e marque **"Leitura de etiqueta por IA"**, depois **Salvar**.
6. O botão **"✨ Preencher com IA"** vai aparecer tanto no cadastro manual da portaria quanto na tela pública do entregador (`/nova`). Teste tirando foto de uma etiqueta de verdade — os campos preenchidos pela IA ficam marcados com "✨ preenchido pela IA — confira", para lembrar de sempre conferir antes de salvar.

Igual ao e-mail: se a IA não estiver configurada ou der erro, o app mostra uma mensagem amigável e o cadastro manual continua funcionando normalmente — nunca trava.

### Passo 5 — Leitura gratuita (sem IA, sem conta, sem custo)

Além do "Preencher com IA" (pago), existe um segundo botão, **"🆓 Ler etiqueta (grátis)"**, que já funciona sem nenhuma configuração — não precisa de conta nem de chave de API.

Ele usa uma tecnologia chamada OCR (reconhecimento de texto em imagem), rodando diretamente no celular/computador de quem está usando, por meio da biblioteca gratuita e de código aberto [Tesseract.js](https://github.com/naptha/tesseract.js).

**Diferença em relação à versão com IA:**
- A versão gratuita só lê o texto que está na etiqueta e tenta "adivinhar" qual trecho é o código de rastreio (procurando um padrão de letras e números, como o formato dos Correios). Ela preenche automaticamente só o campo de código de rastreio.
- Ela também mostra, num link "Ver texto lido na etiqueta", tudo que conseguiu ler na foto — então mesmo sem preencher nome/rua sozinha, ajuda a portaria a copiar essas informações mais rápido do que digitar do zero olhando a etiqueta.
- A versão paga com IA (Claude) entende o que é nome, rua, transportadora etc. e preenche todos os campos, não só o rastreio — por isso é mais completa, mas tem o pequeno custo mostrado no Passo 4.

Pode usar as duas, só uma, ou nenhuma — ficam sempre lado a lado no formulário.

### Passo 6 — Cadastro agora começa pela foto

O fluxo de "Nova encomenda" (tanto na portaria quanto na tela do entregador `/nova`) mudou de ordem:

1. Primeiro aparece uma tela só com o botão **"Tirar foto da etiqueta"**.
2. Ao tirar a foto, o app lê automaticamente (leitura grátis, e também a IA se estiver ligada) e **já avança para o formulário preenchido**, pronto para conferir e corrigir o que estiver errado ou faltando.
3. Essa mesma foto da etiqueta já fica salva como a foto/prova da encomenda — não precisa tirar duas fotos.
4. Quem não tiver uma etiqueta legível (ou preferir não tirar foto) pode clicar em **"Preencher manualmente, sem foto"** e cadastrar do jeito tradicional, digitando tudo.

Os campos que vieram da leitura automática ficam marcados com "✨ preenchido automaticamente — confira", para lembrar sempre de dar uma conferida antes de salvar — a leitura (grátis ou paga) nunca é garantida 100%, por isso o controle final continua sempre com quem está cadastrando.
