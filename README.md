# SIGEN Campo

Leitura simplificada do inventário bovino do **SIGEN+ (CIDASC/SC)** para uso no celular, pensada para quem tem pouca familiaridade com o sistema oficial.

O app mostra uma única coisa, muito bem: **todos os animais bovinos das propriedades do produtor, com brinco, apelido e foto**. Também ajuda a **emitir a GTA** pela tela oficial do SIGEN, com conferência e confirmação. Ele não substitui o SIGEN.

## Como funciona

```
Celular (PWA) ──Tailscale──▶ tailscale serve (HTTPS)
                                  │
                                  ▼ 127.0.0.1:3000
                         Fastify (PWA + API)
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        SQLite (apelidos, fotos, GTAs)     Playwright
                                                │
                                                ▼
                                          SIGEN+ (CIDASC)
```

- O login no SIGEN é feito **sob demanda**, na primeira consulta.
- Para **ler** dados, o Playwright usa `context.request` contra os endpoints internos do SIGEN. Não há scraping de HTML.
- Para **emitir GTA**, o Playwright preenche a tela oficial dentro do iframe e salva pelos mesmos endpoints JSON que a tela usa. A conferência e o salvamento são separados: nada é salvo antes da confirmação.
- A sessão fica ativa por **20 minutos de ociosidade** e então é encerrada.
- Cada consulta baixa um PDF por UEP bovina e o parser valida a contagem contra o total do próprio PDF.
- O SIGEN é a fonte da verdade: **não existe cache de animais**. O SQLite guarda apenas os apelidos, as fotos e o histórico de GTAs.
- A emissão de GTA fica **desligada por padrão** (`GTA_EMISSAO_ATIVA=0`). Sem ela, o app só confere o preenchimento no SIGEN e nunca salva.

## Fotos dos animais

- Toque no círculo ao lado do nome para abrir o diálogo da foto.
- No diálogo: **Ver maior** (tela cheia), **Adicionar/Trocar foto** (galeria ou câmera) e **Remover foto**.
- A foto é recortada no centro e reduzida para 512×512 **no celular**, antes de subir. Isso economiza rede e remove o EXIF da imagem (inclusive a localização).
- Ela fica no servidor, em `data/fotos/<brinco oficial>.jpg`, e aparece em qualquer aparelho — não some ao limpar o navegador.
- A foto não é do SIGEN: é um dado local, como o apelido. Nada é enviado para o CIDASC.

## Emitir GTA

O fluxo acontece **dentro do chat**, em etapas:

1. Toque em **Fazer GTA**, ao lado de **Ver todos os animais** (ou digite “GTA”).
2. O app busca o inventário, se ainda não tiver, e pergunta **quais animais** vão sair.
3. Escolha a **propriedade/UEP** e marque um ou mais animais da mesma origem.
4. Digite o **CPF/CNPJ do destino** no campo de mensagem. Ele é usado só para buscar a propriedade, não fica salvo e aparece mascarado no histórico.
5. Escolha a **UEP de destino**.
6. Responda **finalidade** (padrão ENGORDA), **data da saída** (hoje), **validade** (+3 dias) e **transporte** (padrão RODOVIÁRIO).
7. Na revisão, confira tudo e toque em **Emitir GTA** (ou **Conferir no SIGEN** com a emissão desligada).

Nota fiscal, placa, lacre e observação ficam numa seção opcional da revisão. O app usa os valores fixos da tela oficial: **Dentro do Estado**, destino **Propriedade** e tipo **Normal**.

### Segurança

- A GTA é um **documento oficial**. Depois de emitida, não dá para desfazer pelo app.
- O app confere origem, destino, finalidade, datas e o **brinco oficial de 15 dígitos** de cada animal antes de salvar. Se algo divergir, ele para e não emite.
- Se o SIGEN pedir **senha, anexo, descrição ou justificativa de bloqueio**, o app não salva; avisa para finalizar manualmente.
- Depois do salvamento, o app **nunca repete sozinho**. Se a resposta ficar ambígua, o estado vira **incerta** e você deve conferir no SIGEN antes de tentar de novo.
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

## Requisitos

- Node.js 22.12+
- `poppler-utils` (`pdftotext`) no servidor
- Chromium do Playwright
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

### Login sem colocar a senha no código

```bash
npm run sigen:login
```

Abre um Chromium visível. Faça o login normalmente; o script salva apenas os cookies em `.auth/state.json` (gitignored) e a resposta das UEPs em `fixtures/private/ueps.json`. A senha nunca é lida pelo script.

Valide a leitura:

```bash
npm run sigen:check
```

Saída esperada: 4 propriedades, 12 bovinos.

### Interface sem credenciais

```bash
SIGEN_MOCK=1 npm run dev
```

O mock usa as fixtures sanitizadas de `fixtures/inventory`, então a interface pode ser desenvolvida sem tocar no SIGEN.

### Rodar tudo

```bash
npm run dev
```

- PWA: http://127.0.0.1:5173
- API: http://127.0.0.1:3000
- O Vite faz proxy de `/api` para a API.

### Abrir no celular durante o desenvolvimento

A API pode continuar em `127.0.0.1`: quem fala com o celular é o Vite, e o proxy dele encaminha `/api` para a API.

```bash
# recomendado: só na tailnet, usando o IP do Tailscale
npm run dev:tailscale
# no celular: http://<tailscale ip -4>:5173

# alternativa: todas as interfaces (expõe na LAN também)
npm run dev:lan
# no celular: http://<IP-da-máquina>:5173
```

Use `npm run dev:lan` somente em rede confiável. O servidor de desenvolvimento do Vite não tem autenticação.

Para testar **PWA instalável/HTTPS** no celular, use o build de produção com `tailscale serve` na 443; o service worker não é registrado no modo dev.

### Testes

```bash
npm test
# um arquivo só:
npm run test -w @sigen/api -- src/sigen/pdf.test.ts
npm run typecheck
```

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
- `data/` guarda o SQLite; `.auth/` é montado somente leitura quando você usa a sessão salva.
- A imagem oficial do Playwright já inclui o Chromium; `poppler-utils` é instalado no runtime.

### Servidor de produção

O sistema roda no `desktop-home` (`archlinux`, `100.117.79.72`, `desktop-home.tailb33a32.ts.net`) via Docker Compose.

Atualizar o código a partir da máquina de desenvolvimento:

```bash
npm run deploy
```

O script `scripts/deploy.sh` exporta **apenas o que está commitado** (`git archive`), sincroniza com `rsync` e roda `docker compose up -d --build` por SSH. Pastas de estudo e arquivos não versionados nunca vão para o servidor.

```bash
SIGEN_DEPLOY_HOST=giulio@100.117.79.72 npm run deploy   # outro destino
SIGEN_DEPLOY_REF=master npm run deploy                  # outro commit/branch
```

Se o branch atual não for `master`, o script avisa antes de publicar. Equivalente manual:

```bash
tmp=$(mktemp -d)
git archive --format=tar HEAD | tar -xf - -C "$tmp"
rsync -a --delete \
  --exclude node_modules --exclude .git \
  --exclude data --exclude .auth --exclude .env \
  --exclude fixtures/private --exclude '*.pdf' \
  "$tmp/" giulio@100.117.79.72:~/controle-sigen/
rm -rf "$tmp"

ssh giulio@100.117.79.72 'cd ~/controle-sigen && docker compose up -d --build'
```

O `.env` fica **somente no servidor**, com permissão `600`. O `data/` (apelidos e fotos) nunca é sobrescrito pelo `rsync`.

### Tailscale

No servidor (Tailscale 1.104+):

```bash
tailscale serve --bg 3000
tailscale serve status
```

Em versões mais antigas do CLI: `sudo tailscale serve --bg https / http://127.0.0.1:3000`.

No celular, instale o Tailscale, entre na mesma tailnet e abra `https://desktop-home.tailb33a32.ts.net`. Instale o app pelo menu do navegador (“Adicionar à tela inicial”).

Com `sudo tailscale set --operator=$USER`, o `serve` passa a ser configurado sem `sudo` (use `tailscale serve --bg 3000`).

> Não use `tailscale funnel`: ele publicaria o sistema na internet. O `serve` mantém o acesso restrito à tailnet.
>
> HTTPS é obrigatório para o PWA ser instalável; o `tailscale serve` já fornece um certificado válido.

## Decisões de domínio

- **“Brinco” para o produtor é o Nº Manejo, de 6 dígitos.** É ele que aparece em destaque. O Nº Brinco oficial de 15 dígitos é a chave estável usada para guardar o apelido.
- **Somente BOVINO.** Outras espécies podem existir nas UEPs, mas são ignoradas.
- **Quatro propriedades hoje**, uma delas sem animais. A propriedade vazia aparece como “Sem animais”.
- **Sem paginação ou busca**: o rebanho tem cerca de 12 animais.
- **Sem LLM/MCP nesta versão.** A interface é um chat para listar e um fluxo separado e determinístico para a GTA.
- **A GTA usa a tela oficial.** O app não reimplementa as regras do SIGEN; ele preenche a tela e usa os mesmos endpoints JSON dela.

## Privacidade

- Os PDFs do SIGEN contêm CPF, telefones, endereço e GPS. Eles ficam em `fixtures/private/`, que é gitignored.
- As fixtures versionadas em `fixtures/inventory/` são extrações em texto com esses campos substituídos.
- A senha do SIGEN nunca vai para o navegador do produtor; fica no servidor (`.env` ou secret do Docker) ou apenas na sessão salva localmente.
- As fotos dos animais ficam em `data/fotos/`, no mesmo volume do SQLite. Elas saem do celular já sem metadados e nunca vão para o SIGEN, para o GitHub ou para a imagem Docker.
- Os PDFs das GTAs ficam em `data/gta/`, com permissão `600`, fora do git e servidos com `Cache-Control: no-store`.
- O CPF do produtor é lido da sessão do SIGEN e usado só no servidor. O CPF de um destino de terceiro é digitado no chat, usado só para buscar a UEP e emitir, e não é gravado; no histórico, aparece mascarado.
- Proteja o `.env` com `chmod 600 .env`. Evite rodar `docker compose config` em logs/chats: ele imprime o conteúdo do `.env`, incluindo a senha.
- O app não é oficial. A listagem é de leitura; a GTA é uma automação da tela oficial, com confirmação e sem retentativa automática.

## Estrutura

```
apps/api/
  src/sigen/          sessão Playwright, cliente SIGEN, parser de PDF, driver da GTA
  src/gta/            serviço, runner, schema, PDFs e mock da GTA
  src/routes.ts       API REST
  src/db.ts           SQLite (apelidos, fotos e histórico de GTAs)
  src/photos.ts       arquivos das fotos em data/fotos
  scripts/            login manual, verificação e check da tela de GTA
apps/web/             PWA React + Vite + Tailwind
  src/photo.ts        recorte e redução da foto no navegador
  src/components/GtaChat.tsx  conversa de emissão em etapas
docs/gta-fluxo.md     mapa técnico da tela de GTA (sem PII)
fixtures/inventory/   fixtures sanitizadas (versionadas)
fixtures/private/     PDFs e capturas reais (gitignored)
```

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
