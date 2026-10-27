# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.29-alpine
# O template é processado com envsubst na inicialização do container (LOCALSTACK_URL).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV LOCALSTACK_URL=http://host.docker.internal:4566
EXPOSE 80
