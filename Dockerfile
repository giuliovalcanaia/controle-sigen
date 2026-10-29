# A imagem oficial já traz Node, Chromium e as bibliotecas de sistema.
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS build

WORKDIR /app

# Necessário apenas se o binário pré-compilado do better-sqlite3 não servir.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS runtime

WORKDIR /app

# O parser usa `pdftotext -layout` para manter as colunas do relatório.
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

# Dentro do container precisa escutar em 0.0.0.0 para o port mapping do
# Docker alcançar a API. A exposição externa continua restrita: o Compose
# publica a porta apenas em 127.0.0.1 do host.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/sigen.db

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/fixtures/inventory ./fixtures/inventory

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
