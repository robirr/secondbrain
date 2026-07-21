import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
