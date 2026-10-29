# Operação e desenvolvimento

Detalhes que não precisam ocupar a primeira tela do README: GTA passo a passo, produção, Docker, Tailscale, deploy e problemas comuns.

## Requisitos

- Node.js 22.12+
- `poppler-utils` (`pdftotext`) para ler os PDFs do SIGEN
- Chromium do Playwright para falar com o SIGEN
- Tailscale no servidor e no celular (produção)

```bash
sudo apt install poppler-utils
```

## Desenvolvimento

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

### Interface sem credenciais

```bash
SIGEN_MOCK=1 npm run dev
```

O mock usa as fixtures anonimizadas de `fixtures/inventory`. A interface pode ser desenvolvida sem tocar no SIGEN.

### Login manual

```bash
npm run sigen:login
```

Abre um Chromium visível. Faça o login normalmente; o script salva apenas os cookies em `.auth/state.json` (gitignored) e a resposta das UEPs em `fixtures/private/ueps.json`. A senha nunca é lida pelo script.

Valide a leitura:

```bash
npm run sigen:check
```

### Abrir no celular

A API pode continuar em `127.0.0.1`: quem fala com o celular é o Vite, e o proxy dele encaminha `/api` para a API.

```bash
# recomendado: só na tailnet, usando o IP do Tailscale
npm run dev:tailscale
# no celular: http://<tailscale-ip>:5173

# alternativa: todas as interfaces (expõe na LAN também)
npm run dev:lan
# no celular: http://<ip-da-máquina>:5173
```

Use `npm run dev:lan` somente em rede confiável. O servidor de desenvolvimento do Vite não tem autenticação.

Para testar PWA instalável/HTTPS no celular, use o build de produção com `tailscale serve` na 443; o service worker não é registrado no modo dev.

### Testes

```bash
npm test
npm run typecheck
# um arquivo só:
npm run test -w @sigen/api -- src/sigen/pdf.test.ts
```

### Imagens do README

```bash
npm run screenshots
```

Compila o projeto e captura as telas com o modo mock em um banco temporário. Nenhum apelido, foto ou dado real de `data/` é usado. As imagens saem em `docs/assets/`.

## Emitir GTA

O fluxo acontece dentro do chat, em etapas:

1. Toque em **Fazer GTA**, ao lado de **Ver todos os animais** (ou digite “GTA”).
2. O app busca o inventário, se ainda não tiver, e pergunta **quais animais** vão sair.
3. A lista mostra todos os animais, agrupados por propriedade/UEP. Marque um ou mais; o primeiro marcado define a origem (a GTA tem uma só) e **Trocar** limpa a seleção.
4. Digite o **CPF/CNPJ do destino** no campo de mensagem. Ele é usado só para buscar a propriedade, não fica salvo e aparece mascarado no histórico.
5. Escolha a **UEP de destino**.
6. Confira o cartão **Finalidade e datas**: finalidade (ENGORDA), saída (hoje), validade (+3 dias) e transporte (RODOVIÁRIO) já vêm preenchidos. Toque em um item para alterar.
7. O app pergunta se você quer informar **nota fiscal** e **placa**. Se disser **Não**, vai direto à revisão. Se disser **Sim**, as duas podem ficar em branco (basta tocar em **Continuar**).
8. Na revisão, confira tudo e toque em **Emitir GTA** (ou **Conferir no SIGEN** com a emissão desligada).

Lacre e observação ficam numa seção opcional da revisão. O app usa os valores fixos da tela oficial: **Dentro do Estado**, destino **Propriedade** e tipo **Normal**.

### Segurança

- A GTA é um **documento oficial**. Depois de emitida, não dá para desfazer pelo app.
- Uma **viagem** (propriedade de origem + animais + data de saída) só é emitida uma vez. Placa, nota, finalidade ou destino diferentes não liberam uma segunda GTA; correções são feitas no SIGEN.
- Um animal que já está em outra GTA do mesmo dia também bloqueia a emissão.
- O app confere origem, destino, finalidade, datas e o **brinco oficial de 15 dígitos** de cada animal antes de salvar. Se algo divergir, ele para e não emite.
- Se o SIGEN pedir **senha, anexo, descrição ou justificativa de bloqueio**, o app não salva; avisa para finalizar manualmente.
- Depois do salvamento, o app **nunca repete sozinho**. Se a resposta ficar ambígua, o estado vira **incerta** e o card mostra **Foi emitida** / **Não foi emitida**; até você responder, a mesma viagem fica bloqueada.
- Só uma emissão por vez. A sessão do SIGEN serializa tudo.

### Modo conferência

Com `GTA_EMISSAO_ATIVA=0` (padrão), o botão final vira **Conferir no SIGEN**: o app preenche a tela oficial, faz a conferência e a checagem de permissão, e para **antes de salvar**. Nada é emitido.

Para habilitar a emissão de verdade, depois de validar com uma GTA real:

```bash
# no .env do servidor
GTA_EMISSAO_ATIVA=1
```

### Limites desta versão

- Só **dentro de Santa Catarina** e destino **Propriedade**.
- Sem GTA interestadual, agroindústria, evento ou produtor.
- Sem anexos/exames, vacinações, aviso por e-mail/telefone ou cancelamento.
- O PDF, quando o SIGEN oferece, fica em `data/gta/<id>.pdf` e é servido com `no-store`.

### Verificação sem emitir

```bash
npm run sigen:gta:check
```

Abre a tela de GTA e confere os componentes e o listener da data. Não preenche e não salva. Rode depois de atualizações do SIGEN.

## Produção

```bash
npm run build
npm start
```

O Fastify serve `apps/web/dist` e a API na mesma origem.

### Docker

```bash
cp .env.example .env
docker compose up -d --build
```

- Dentro do container a API escuta em `0.0.0.0:3000`; o Compose publica a porta apenas em `127.0.0.1:3000` do host.
- `data/` guarda o SQLite, as fotos e os PDFs das GTAs; `.auth/` é montado somente leitura quando você usa a sessão salva.
- A imagem oficial do Playwright já inclui o Chromium; `poppler-utils` é instalado no runtime.

### Servidor

O sistema roda em um servidor Linux via Docker Compose. O endereço real não fica no repositório: configure `SIGEN_DEPLOY_HOST` em `.deploy.env` (gitignored) ou no ambiente.

Atualizar o código a partir da máquina de desenvolvimento:

```bash
npm run deploy
```

O script `scripts/deploy.sh` exporta **apenas o que está commitado** (`git archive`), sincroniza com `rsync` e roda `docker compose up -d --build` por SSH. Pastas de estudo e arquivos não versionados nunca vão para o servidor.

```bash
SIGEN_DEPLOY_HOST=usuario@servidor npm run deploy   # outro destino
SIGEN_DEPLOY_REF=master npm run deploy              # outro commit/branch
```

### Backup antes do deploy

O `rsync` usa `--delete` e remove arquivos não versionados dentro de `~/controle-sigen`. Guarde o backup **fora** desse diretório:

```bash
ssh usuario@servidor \
  'dest="$HOME/controle-sigen-backups/data-$(date +%F-%H%M%S)"; \
   mkdir -p "$dest"; cp -a "$HOME/controle-sigen/data/." "$dest/"'
```

`data/` contém o SQLite, as fotos e os PDFs das GTAs. O script exclui `backups/` do espelhamento por segurança, mas a pasta recomendada continua sendo `~/controle-sigen-backups`.

Se o branch atual não for `master`, o script avisa antes de publicar. Equivalente manual:

```bash
tmp=$(mktemp -d)
git archive --format=tar HEAD | tar -xf - -C "$tmp"
rsync -a --delete \
  --exclude node_modules --exclude .git \
  --exclude data --exclude backups --exclude .auth --exclude .env \
  --exclude fixtures/private --exclude '*.pdf' \
  "$tmp/" usuario@servidor:~/controle-sigen/
rm -rf "$tmp"

ssh usuario@servidor 'cd ~/controle-sigen && docker compose up -d --build'
```

O `.env` fica **somente no servidor**, com permissão `600`. O `data/` (apelidos, fotos e GTAs) nunca é sobrescrito pelo `rsync`.

### Tailscale

No servidor (Tailscale 1.104+):

```bash
tailscale serve --bg 3000
tailscale serve status
```

Em versões mais antigas do CLI: `sudo tailscale serve --bg https / http://127.0.0.1:3000`.

No celular, instale o Tailscale, entre na mesma tailnet e abra o endereço HTTPS da máquina. Instale o app pelo menu do navegador (“Adicionar à tela inicial”).

Com `sudo tailscale set --operator=$USER`, o `serve` passa a ser configurado sem `sudo`.

> Não use `tailscale funnel`: ele publicaria o sistema na internet. O `serve` mantém o acesso restrito à tailnet.
>
> HTTPS é obrigatório para o PWA ser instalável; o `tailscale serve` já fornece um certificado válido.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `PDF_TOOL_MISSING` | Falta `poppler-utils` no servidor |
| `Chromium não instalado` | Rode `npx playwright install chromium` |
| `SEM_CREDENCIAIS` | Configure `.env` ou rode `npm run sigen:login` |
| `SESSAO_EXPIRADA` | A sessão de 20 min caiu; a próxima consulta reloga |
| `PDF_LAYOUT_MUDOU` | O SIGEN mudou o relatório; atualize o parser e as fixtures |
| `UEP_LIST_EMPTY` | A conta não retornou UEPs ou o endpoint mudou |
| `GTA_TELA_MUDOU` | A tela de GTA do SIGEN mudou; rode `npm run sigen:gta:check` |
| `GTA_INDISPONIVEL` | Emissão desativada ou o SIGEN pede senha/anexo; finalize no SIGEN |
| `GTA_EM_ANDAMENTO` / `GTA_INCERTA` | Confira no SIGEN antes de tentar de novo |
| `GTA_JA_EMITIDA` | A mesma GTA já foi emitida há pouco; confirme antes de reemitir |

## Privacidade na operação

- Os PDFs do SIGEN contêm CPF, telefones, endereço e GPS. Eles ficam em `fixtures/private/`, que é gitignored.
- As fixtures versionadas em `fixtures/inventory/` usam códigos, localidades e brincos fictícios.
- A senha do SIGEN nunca vai para o navegador do produtor; fica no servidor (`.env` ou secret do Docker) ou apenas na sessão salva localmente.
- As fotos dos animais ficam em `data/fotos/`, no mesmo volume do SQLite. Elas saem do celular já sem metadados e nunca vão para o SIGEN, para o GitHub ou para a imagem Docker.
- Os PDFs das GTAs ficam em `data/gta/`, com permissão `600`, fora do git e servidos com `Cache-Control: no-store`.
- O CPF do produtor é lido da sessão do SIGEN e usado só no servidor. O CPF de um destino de terceiro é digitado no chat, usado só para buscar a UEP e emitir, e não é gravado; no histórico, aparece mascarado.
- Proteja o `.env` com `chmod 600 .env`. Evite rodar `docker compose config` em logs/chats: ele imprime o conteúdo do `.env`, incluindo a senha.
- O app não é oficial. A listagem é de leitura; a GTA é uma automação da tela oficial, com confirmação e sem retentativa automática.
