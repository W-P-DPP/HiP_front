import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiBaseKey = env.VITE_API_BASE_KEY
  const apiBaseUrl = env.VITE_API_BASE_URL
  const base = env.VITE_ENV === 'development' ? '/dev/hip' : "/hip"
  // 微信业务接口挂在 ${base}/wx 下（不带 /api 段），单独开一条 proxy；不能整体放开 /hip（会劫持 dev 静态资源）
  const wxProxyKey = `${apiBaseKey.replace(/\/api$/, '')}/wx`
  // 登录/注册接口挂在 ${base}/auth 下（不带 /api 段），单独开一条 proxy
  const authProxyKey = `${apiBaseKey.replace(/\/api$/, '')}/auth`

  return {
    base,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'front',

    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // dev 下把 API 路径前缀转发到后端，浏览器保持同源以便携带 cookie
        [apiBaseKey]: {
          target: apiBaseUrl,
          changeOrigin: true,
        },
        [wxProxyKey]: {
          target: apiBaseUrl,
          changeOrigin: true,
        },
        [authProxyKey]: {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
    ssr: {
      // 将所有依赖都打包，不排除任何包
      noExternal: true,  // 改为 true，而不是只包含dependencies
      // 或者使用：noExternal: Object.keys(allDependencies),
    },
  }
})
