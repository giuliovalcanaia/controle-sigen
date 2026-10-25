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
- Checagem somente leitura da tela de GTA: `npm run sigen:gta:check`
- Diagnóstico da resposta de UEPs (sem PII): `npm run sigen:inspect -w @sigen/api`
- A sessão manual fica em `.auth/state.json` (gitignored); a API a usa quando `SIGEN_STORAGE_STATE` aponta para ela.
- npm 12 bloqueia scripts de instalação. Se adicionar dependência com `postinstall`, aprove com `npm install-scripts approve <pkg>`; o `allowScripts` do `package.json` registra as exceções.

## Arquitetura

- `apps/api/src/sigen/session.ts` — singleton de sessão. Login preguiçoso, **20 min de ociosidade**, mutex global, um único `BrowserContext`. `withWritePage` entrega a página e **não repete** a função (usado na GTA).
- `apps/api/src/sigen/client.ts` — após o login, usa `context.request` contra endpoints internos do SIGEN. Não navegue pela UI para ler dados.
- `apps/api/src/sigen/gta.ts` — driver da tela de GTA. Preenche a tela ExtJS no iframe e salva pelos endpoints JSON (`Add`/`Get`/`Print`). Nunca repete o `Add`.
- `apps/api/src/gta/` — serviço, runner, schema, store de PDFs e mock da GTA.
- `apps/api/src/sigen/pdf.ts` — `pdftotext -layout` + parser do relatório. Depende de `poppler-utils`.
- `apps/api/src/sigen/uep.ts` — descobre IDs de UEP varrendo o JSON, sem depender de caminho fixo.
- `apps/api/src/db.ts` — SQLite (`better-sqlite3`) com apelidos, versão das fotos e histórico de GTAs.
- `apps/api/src/photos.ts` — arquivos das fotos em `data/fotos/<brinco oficial>.jpg`.
- `apps/api/src/gta/pdf.ts` — PDFs das GTAs em `data/gta/<id>.pdf`.
- `apps/web/` — PWA React/Vite/Tailwind; chat de listagem + conversa de GTA em etapas (`components/GtaChat.tsx`).
- `docs/gta-fluxo.md` — mapa técnico da tela de GTA (sem PII).

## Invariantes que não podem quebrar

1. **“Brinco” exibido = Nº Manejo, 6 dígitos.** Preserve zeros à esquerda (`067836`).
2. **Chave do apelido = Nº Brinco oficial, 15 dígitos.** Não use o manejo como chave.
3. **Somente BOVINO.** O PDF traz `Espécie:`; filtre no cliente, não no parser.
4. **Valide a contagem** de linhas contra `Qtde. Animais`. Se divergir, lance `PDF_LAYOUT_MUDOU`; nunca devolva dados parciais.
5. **UEP sem saldo** não é erro: o PDF não tem tabela e traz “não possui saldo animal”. Retorne 0 animais.
6. **Sem cache de animais.** Toda consulta baixa PDFs novos. O SIGEN é a fonte da verdade.
7. **Uma sessão por processo.** Não crie outro `BrowserContext`/Playwright em paralelo; o SIGEN derruba a sessão anterior.
8. **20 minutos de ociosidade**, não tempo total. Toda requisição reinicia o relógio. `SIGEN_IDLE_MINUTES` altera.
9. **Foto é dado local**, não do SIGEN. Fica em `data/fotos` com a chave oficial, fora do git e da imagem Docker. Nunca envie foto ao SIGEN.
10. **GTA é documento oficial.** Depois do `POST /SaidaAnimais/Add`, nunca repita o salvamento sozinho. Resposta ambígua vira `incerta` e o produtor confere no SIGEN.
11. **Emissão desligada por padrão.** `GTA_EMISSAO_ATIVA=0` só confere a tela; `1` só depois de uma emissão real validada.
12. **CPF não vaza.** O CPF do produtor vem da sessão do SIGEN e fica no servidor. O CPF de terceiro é digitado no chat, usado só para buscar a UEP e emitir, e nunca vai para log ou banco. No histórico, aparece mascarado.
13. **PDF de GTA é privado.** Fica em `data/gta`, permissão `600`, fora do git, servido com `no-store`.
14. **Falhe antes de salvar.** O driver confere origem, destino, finalidade, datas e o brinco oficial de 15 dígitos de cada animal. Se a tela mudar, lance `GTA_TELA_MUDOU` e não emita.
15. **Uma emissão por vez.** A sessão serializa; não abra outro Playwright durante a GTA.

## Domínio

- Endpoint de listagem: `GET /DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome`
- Endpoint do PDF por UEP: `POST /DSA.Cadastros/UnidadeExploracao/ImprimeInventarioAnimais?idUnidadeExploracao=<id>&dtConsulta=<ISO>`
- Tela de GTA: `/DSA.Areas.Movimentacao/SaidaAnimais` (ExtJS dentro de `iframe#iframeMain`).
- Busca de UEP por CPF/CNPJ: `POST /DSA.Cadastros/UnidadeExploracao/QuickSearch` (form; GET devolve 404).
- Emissão: `POST /DSA.Areas.Movimentacao/SaidaAnimais/Add`; leitura do número: `GET .../SaidaAnimais/Get/<id>`; PDF: `POST .../SaidaAnimais/Print`.
- Permissão de apoio (somente leitura): `POST .../SaidaAnimais/VerificarPermissaoApoio`.
- O mapa completo está em `docs/gta-fluxo.md`.
- Hoje: 4 propriedades, 12 bovinos, uma propriedade sem animais (deve aparecer como “Sem animais”).
- O produtor chama o manejo de “brinco”; o número oficial de 15 dígitos é interno.

## Fixtures e PII

- `fixtures/private/` contém PDFs reais com CPF, telefone, endereço e GPS. **Nunca versione.**
- `fixtures/inventory/*.txt` são fixtures sanitizadas e versionadas. Use-as nos testes.
- `Fluxo emitir GTA/` contém capturas com PII e está no `.gitignore`. Nunca versione.
- Os PDFs das GTAs ficam em `data/gta/`, fora do git e da imagem Docker.
- Se precisar de um PDF novo, salve em `fixtures/private/` e gere a fixture em texto redigida.
- Não peça nem registre credenciais do SIGEN. Use `.env` local ou `npm run sigen:login`.

## Frontend

- O número em destaque é o manejo; o oficial só aparece em detalhes (se aparecer).
- Animais com apelido vêm primeiro, em ordem alfabética; os demais por brinco.
- O círculo ao lado do nome é o botão da foto: toque abre o diálogo com ver em tela cheia, trocar e remover. Sem foto, mostra a inicial (ou o ícone de boi quando não há apelido).
- A redução para 512×512 acontece no navegador (`src/photo.ts`); nunca suba o original.
- O botão **Fazer GTA** fica ao lado de **Ver todos os animais**, no composer. O fluxo acontece no chat, sem modal: animais → CPF → UEP → finalidade → saída → validade → transporte → revisão → resultado.
- A seleção é uma lista única com todos os animais (sem abas), agrupada por propriedade/UEP. O primeiro animal marcado trava a origem; os outros grupos ficam desabilitados até tocar em **Trocar**.
- O CPF de destino é digitado no campo de mensagem e não entra no histórico: a bolha mostra só a máscara (`***.***.***-01`). O campo fica numérico e é limpo depois.
- Digitar “GTA” inicia a conversa, mas a emissão só acontece pelo botão/checkbox da revisão. Textos em português simples, botões grandes.
- Com `GTA_EMISSAO_ATIVA=0`, o botão final é **Conferir no SIGEN** e nada é salvo. Com `1`, a revisão exige o checkbox “Entendi que não pode ser desfeita”.
- O service worker cacheia apenas a casca do PWA. Nunca cacheie `/api/*` (inclui `/api/gta/*`).
- O composer usa `100dvh` e `env(safe-area-inset-bottom)`; teste no viewport de 390 px.

## Deploy

- Servidor de produção: `desktop-home` (`archlinux`, `100.117.79.72`, `desktop-home.tailb33a32.ts.net`), Docker Compose em `~/controle-sigen`.
- Atualizar: `npm run deploy` (`git archive` + `rsync` + `docker compose up -d --build`); o script está em `scripts/deploy.sh`.
- O deploy envia **somente arquivos commitados**. Pastas não versionadas (estudos, capturas) nunca vão para o servidor.
- `tailscale serve --bg 3000` publica em HTTPS na tailnet (CLI 1.104+). Nunca use `tailscale funnel`.
- O `.env` existe apenas no servidor (`600`); nunca o envie para o repositório.
- Bind em `127.0.0.1` no host; acesso via `tailscale serve` (HTTPS). Nunca `tailscale funnel`.
- No container Docker, a API escuta em `0.0.0.0`; o Compose publica a porta somente em `127.0.0.1` do host. Não troque o bind do host para `0.0.0.0`.
- Docker Compose monta `./data` (apelidos, fotos e `gta/`) e, opcionalmente, `./.auth` somente leitura.
- `poppler-utils` precisa existir na imagem de runtime (já incluído no Dockerfile).
- A emissão de GTA só é habilitada no `.env` do servidor (`GTA_EMISSAO_ATIVA=1`) **depois** de uma emissão real validada. Antes disso, deixe `0`.
- Depois de atualizações do SIGEN, rode `npm run sigen:gta:check` (somente leitura) antes de emitir.
