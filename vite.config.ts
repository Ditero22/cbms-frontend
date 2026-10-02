import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))

function parseConfigurationUrl(value: string, name: string, base?: string) {
  try {
    return new URL(value, base)
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) API URL.`)
  }
}

export function resolveApiBase(value: string | undefined, production: boolean) {
  const apiBase = value?.trim() || '/api/v1'
  const apiUrl = parseConfigurationUrl(apiBase, 'VITE_API_URL', 'http://localhost')
  if (
    (!apiBase.startsWith('/') && !/^https?:\/\//.test(apiBase)) ||
    apiBase.startsWith('//') ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    (apiBase.startsWith('/') && apiUrl.pathname.replace(/\/+$/, '') !== '/api/v1') ||
    !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api/v1')
  ) {
    throw new Error('VITE_API_URL must be /api/v1 or an HTTP(S) API URL ending in /api/v1.')
  }
  if (production && apiBase.replace(/\/+$/, '') !== '/api/v1') {
    throw new Error(
      'Production VITE_API_URL must be /api/v1. Configure the server-side proxy with CBMS_API_ORIGIN.',
    )
  }
  return apiBase
}

export default defineConfig(({ mode, command }) => {
  const configuration = loadEnv(mode, sourceDirectory, ['CBMS_', 'VITE_API_URL'])
  const apiProxyTarget = configuration.CBMS_API_PROXY_TARGET || 'http://127.0.0.1:3000'
  const target = parseConfigurationUrl(apiProxyTarget, 'CBMS_API_PROXY_TARGET')
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('CBMS_API_PROXY_TARGET must be an HTTP(S) origin without credentials.')
  }
  resolveApiBase(configuration.VITE_API_URL, command === 'build')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: apiProxyTarget } },
    },
    resolve: {
      alias: { '@': path.resolve(sourceDirectory, 'src') },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-'))
              return 'charts'
            if (id.includes('/node_modules/lucide-react/')) return 'icons'
            if (id.includes('/node_modules/@tanstack/')) return 'data-tools'
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router')
            )
              return 'react-vendor'
          },
        },
      },
    },
  }
})
