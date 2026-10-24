# AGENTS.md

## Comandos

```bash
npm install                 # npm workspaces; NÃO use pnpm/yarn
npx playwright install chromium
npm run dev                 # API :3000 + PWA :5173 (Vite faz proxy de /api)
npm run dev:tailscale       # Vite no IP do Tailscale; API continua em 127.0.0.1
npm run dev:lan             # Vite em 0.0.0.0 (expõe na LAN; use só em rede confiável)
npm test                    # Vitest da API
npm run typecheck
npm run build && npm start  # produção: Fastify serve o PWA e a API
```

- Teste único: `npm run test -w @sigen/api -- src/sigen/pdf.test.ts`
- Interface sem SIGEN: `SIGEN_MOCK=1 npm run dev`
- Login manual (abre Chromium visível): `npm run sigen:login`
- Verificação ponta a ponta: `npm run sigen:check`
- Diagnóstico da resposta de UEPs (sem PII): `npm run sigen:inspect -w @sigen/api`
- A sessão manual fica em `.auth/state.json` (gitignored); a API a usa quando `SIGEN_STORAGE_STATE` aponta para ela.
- npm 12 bloqueia scripts de instalação. Se adicionar dependência com `postinstall`, aprove com `npm install-scripts approve <pkg>`; o `allowScripts` do `package.json` registra as exceções.

## Arquitetura

- `apps/api/src/sigen/session.ts` — singleton de sessão. Login preguiçoso, **20 min de ociosidade**, mutex global, um único `BrowserContext`.
- `apps/api/src/sigen/client.ts` — após o login, usa `context.request` contra endpoints internos do SIGEN. Não navegue pela UI para ler dados.
- `apps/api/src/sigen/pdf.ts` — `pdftotext -layout` + parser do relatório. Depende de `poppler-utils`.
- `apps/api/src/sigen/uep.ts` — descobre IDs de UEP varrendo o JSON, sem depender de caminho fixo.
- `apps/api/src/db.ts` — SQLite (`better-sqlite3`) apenas com apelidos.
- `apps/web/` — PWA React/Vite/Tailwind; chat com uma única ação.

## Invariantes que não podem quebrar

1. **“Brinco” exibido = Nº Manejo, 6 dígitos.** Preserve zeros à esquerda (`067836`).
2. **Chave do apelido = Nº Brinco oficial, 15 dígitos.** Não use o manejo como chave.
3. **Somente BOVINO.** O PDF traz `Espécie:`; filtre no cliente, não no parser.
4. **Valide a contagem** de linhas contra `Qtde. Animais`. Se divergir, lance `PDF_LAYOUT_MUDOU`; nunca devolva dados parciais.
5. **UEP sem saldo** não é erro: o PDF não tem tabela e traz “não possui saldo animal”. Retorne 0 animais.
6. **Sem cache de animais.** Toda consulta baixa PDFs novos. O SIGEN é a fonte da verdade.
7. **Uma sessão por processo.** Não crie outro `BrowserContext`/Playwright em paralelo; o SIGEN derruba a sessão anterior.
8. **20 minutos de ociosidade**, não tempo total. Toda requisição reinicia o relógio. `SIGEN_IDLE_MINUTES` altera.

## Domínio

- Endpoint de listagem: `GET /DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome`
- Endpoint do PDF por UEP: `POST /DSA.Cadastros/UnidadeExploracao/ImprimeInventarioAnimais?idUnidadeExploracao=<id>&dtConsulta=<ISO>`
- Hoje: 4 propriedades, 12 bovinos, uma propriedade sem animais (deve aparecer como “Sem animais”).
- O produtor chama o manejo de “brinco”; o número oficial de 15 dígitos é interno.

## Fixtures e PII

- `fixtures/private/` contém PDFs reais com CPF, telefone, endereço e GPS. **Nunca versione.**
- `fixtures/inventory/*.txt` são fixtures sanitizadas e versionadas. Use-as nos testes.
- Se precisar de um PDF novo, salve em `fixtures/private/` e gere a fixture em texto redigida.
- Não peça nem registre credenciais do SIGEN. Use `.env` local ou `npm run sigen:login`.

## Frontend

- O número em destaque é o manejo; o oficial só aparece em detalhes (se aparecer).
- Animais com apelido vêm primeiro, em ordem alfabética; os demais por brinco.
- Textos em português simples, botões grandes, uma ação principal.
- O service worker cacheia apenas a casca do PWA. Nunca cacheie `/api/*`.
- O composer usa `100dvh` e `env(safe-area-inset-bottom)`; teste no viewport de 390 px.

## Deploy

- Bind em `127.0.0.1` no host; acesso via `tailscale serve` (HTTPS). Nunca `tailscale funnel`.
- No container Docker, a API escuta em `0.0.0.0`; o Compose publica a porta somente em `127.0.0.1` do host. Não troque o bind do host para `0.0.0.0`.
- Docker Compose monta `./data` e, opcionalmente, `./.auth` somente leitura.
- `poppler-utils` precisa existir na imagem de runtime (já incluído no Dockerfile).
