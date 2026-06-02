# ---------- Estágio 1: build do Angular ----------
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências (camada cacheável)
COPY package.json package-lock.json* ./
RUN npm install

# Copia o código e gera o build de produção
COPY . .
RUN npm run build

# ---------- Estágio 2: Nginx servindo os estáticos ----------
FROM nginx:1.27-alpine

# Configuração do servidor (SPA + proxy /api/)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefatos do build do Angular (outputPath: dist/codex)
COPY --from=build /app/dist/codex/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
