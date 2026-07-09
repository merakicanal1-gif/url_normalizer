# --- Estágio 1: Compilação ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifesto e arquivos de dependência
COPY package*.json ./

# Instala todas as dependências (incluindo devDependencies para compilador)
RUN npm ci

# Copia arquivos fontes e configurações
COPY tsconfig.json ./
COPY src/ ./src/

# Executa a limpeza e build de produção (gera a pasta /dist)
RUN npm run build

# Remove as devDependencies para economizar espaço em disco
RUN npm prune --production

# --- Estágio 2: Execução ---
FROM node:22-alpine AS runner

WORKDIR /app

# Variáveis de ambiente de produção padrões
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV BROWSERLESS_URL=ws://browserless:3000
ENV TIMEOUT_MS=30000

# Copia arquivos necessários do estágio de compilação
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expõe a porta de escuta configurada
EXPOSE 3000

# Comando para iniciar o servidor Node.js
CMD ["node", "dist/infrastructure/transport/http/server.js"]
