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
