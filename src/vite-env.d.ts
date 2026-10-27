/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端服务地址（origin），dev 用作 dev proxy 目标、生产拼进 baseURL */
  readonly VITE_API_BASE_URL?: string
  /** API 路径前缀（如 /hip/api），dev 下作为浏览器同源 baseURL */
  readonly VITE_API_BASE_KEY?: string
  /** 预登录 token（JWT），初始化前写入 token cookie */
  readonly VITE_COOKIES?: string
}
