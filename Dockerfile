# --- Build-Stufe: Vite-Produktionsbuild ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# vite build (ohne tsc-Gate für robustes Container-Build)
RUN npx vite build

# --- Serve-Stufe: statische Auslieferung via nginx ---
FROM nginx:alpine
# Template wird beim Start via envsubst (${QMD_URL}) zu conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV QMD_URL=http://host.docker.internal:8181
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
