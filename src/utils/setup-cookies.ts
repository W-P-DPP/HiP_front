import { clearCookies } from "./auth"

// 初始化前写入鉴权 cookie：key=token，值取自环境变量 VITE_COOKIES（开发/测试预登录用）
const TOKEN_KEY = 'token'

function getCookie(name: string): string | null {
  const prefix = `${name}=`
  const found = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

/** 已存在 token cookie 时不覆盖，避免冲掉用户已登录的会话 */
export function setupCookies(): void {
  clearCookies()
  const token = import.meta.env.VITE_COOKIES
  if (!token || getCookie(TOKEN_KEY)) return
  document.cookie = `${TOKEN_KEY}=${token}; path=/`
}
