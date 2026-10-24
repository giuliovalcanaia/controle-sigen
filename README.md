# SIGEN Campo

Leitura simplificada do inventário bovino do **SIGEN+ (CIDASC/SC)** para uso no celular, pensada para quem tem pouca familiaridade com o sistema oficial.

O app mostra uma única coisa, muito bem: **todos os animais bovinos das propriedades do produtor, com brinco e apelido**. Ele não substitui o SIGEN e não emite documentos.

## Como funciona

```
Celular (PWA) ──Tailscale──▶ tailscale serve (HTTPS)
                                  │
                                  ▼ 127.0.0.1:3000
                         Fastify (PWA + API)
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              SQLite (apelidos)          Playwright
                                                │
                                                ▼
                                          SIGEN+ (CIDASC)
```

- O login no SIGEN é feito **sob demanda**, na primeira consulta.
- Depois do login, o Playwright usa `context.request` para chamar os endpoints internos do SIGEN. Não há clique em tela nem scraping de HTML.
- A sessão fica ativa por **20 minutos de ociosidade** e então é encerrada.
- Cada consulta baixa um PDF por UEP bovina e o parser valida a contagem contra o total do próprio PDF.
- O SIGEN é a fonte da verdade: **não existe cache de animais**. O SQLite guarda apenas os apelidos.

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

### Tailscale

No servidor:

```bash
sudo tailscale serve --bg https / http://127.0.0.1:3000
tailscale serve status
```

No celular, instale o Tailscale, entre na mesma tailnet e abra `https://<máquina>.<tailnet>.ts.net`. Instale o app pelo menu do navegador (“Adicionar à tela inicial”).

> Não use `tailscale funnel`: ele publicaria o sistema na internet. O `serve` mantém o acesso restrito à tailnet.
>
> HTTPS é obrigatório para o PWA ser instalável; o `tailscale serve` já fornece um certificado válido.

## Decisões de domínio

- **“Brinco” para o produtor é o Nº Manejo, de 6 dígitos.** É ele que aparece em destaque. O Nº Brinco oficial de 15 dígitos é a chave estável usada para guardar o apelido.
- **Somente BOVINO.** Outras espécies podem existir nas UEPs, mas são ignoradas.
- **Quatro propriedades hoje**, uma delas sem animais. A propriedade vazia aparece como “Sem animais”.
- **Sem paginação ou busca**: o rebanho tem cerca de 12 animais.
- **Sem LLM/MCP nesta versão.** A interface é um chat com uma única ação determinística.

## Privacidade

- Os PDFs do SIGEN contêm CPF, telefones, endereço e GPS. Eles ficam em `fixtures/private/`, que é gitignored.
- As fixtures versionadas em `fixtures/inventory/` são extrações em texto com esses campos substituídos.
- A senha do SIGEN nunca vai para o navegador do produtor; fica no servidor (`.env` ou secret do Docker) ou apenas na sessão salva localmente.
- Proteja o `.env` com `chmod 600 .env`. Evite rodar `docker compose config` em logs/chats: ele imprime o conteúdo do `.env`, incluindo a senha.
- O app não é oficial. A consulta é apenas de leitura.

## Estrutura

```
apps/api/
  src/sigen/          sessão Playwright, cliente SIGEN, parser de PDF
  src/routes.ts       API REST
  scripts/            login manual e verificação
apps/web/             PWA React + Vite + Tailwind
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
