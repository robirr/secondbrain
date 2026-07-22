# =====================================================================
#  Second Brain — ALLES IN EINEM CONTAINER (App + qmd-Suche + nginx)
#  Ein Image, ein `docker compose up`. qmd läuft mit im Container;
#  Modelle/Index liegen im persistenten Volume /qmd-home.
# =====================================================================

# --- Build-Stufe: Vite-Produktionsbuild ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (nicht ci): holt plattformgerecht das Linux-Binary von rolldown/vite.
# `npm ci` scheitert hier, weil der Lockfile unter Windows erzeugt wurde und das
# Linux-native-Binary (@rolldown/binding-linux-x64-gnu) nicht strikt auflöst.
RUN npm install --no-audit --no-fund
COPY . .
# vite build (ohne tsc-Gate für robustes Container-Build)
RUN npx vite build

# --- Laufzeit: nginx (Auslieferung + Proxy) + qmd (Suche) ---
FROM node:22-bookworm-slim
# nginx + envsubst + Compiler-Toolchain für qmds native Module
# (node-llama-cpp, better-sqlite3, tree-sitter brauchen python3/make/g++/cmake/git)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nginx gettext-base wget ca-certificates \
      python3 make g++ cmake git \
 && rm -rf /var/lib/apt/lists/* \
 && rm -f /etc/nginx/sites-enabled/default

# qmd global (feste Version) — lädt seine Modelle erst beim ersten Start.
# --foreground-scripts zeigt native Build-Ausgaben direkt im CI-Log.
RUN npm i -g --foreground-scripts @tobilu/qmd@2.5.3

# App-Build in den nginx-Ausgabeordner; der Vault wird zur Laufzeit unter data/ gemountet
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# qmd-Zuhause: Modelle, Konfig UND Index landen alle unter $HOME -> ein Volume genügt
ENV HOME=/qmd-home \
    XDG_CONFIG_HOME=/qmd-home/.config \
    XDG_CACHE_HOME=/qmd-home/.cache \
    XDG_DATA_HOME=/qmd-home/.local/share \
    QMD_URL=http://127.0.0.1:8181 \
    VAULT=/usr/share/nginx/html/data
VOLUME ["/qmd-home"]

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["/docker-entrypoint.sh"]
