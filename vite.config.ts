import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.LOCALSTACK_URL || 'http://localhost:4566'

  const proxy: Record<string, ProxyOptions> = {
    '/localstack': {
      target,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/localstack/, ''),
      // Sem o Origin, o LocalStack não aplica a política de CORS (a chamada já é same-origin).
      configure: (p) => {
        p.on('proxyReq', (req) => {
          req.removeHeader('origin')
          req.removeHeader('referer')
        })
      },
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    build: { chunkSizeWarningLimit: 800 },
    preview: { port: 4173, proxy },
  }
})
