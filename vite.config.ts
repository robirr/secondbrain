import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vaultDev } from './vite-plugin-vault.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
// Vault-Wurzel: zwei Ebenen hoch (_system/brain-app -> _system -> Wurzel), wie ROOT in _system/scripts/lib.mjs
const VAULT = process.env.VAULT_ROOT ? resolve(process.env.VAULT_ROOT) : resolve(HERE, '..', '..')

export default defineConfig({
  plugins: [react(), tailwindcss(), vaultDev(VAULT)],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    host: true,
    // Dev: qmd-Bedeutungssuche gleich-Origin über /qmd -> lokaler qmd-HTTP-Dienst (qmd mcp --http)
    proxy: {
      '/qmd': {
        target: 'http://localhost:8181',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/qmd/, ''),
      },
    },
  },
})
