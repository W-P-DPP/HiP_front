// 登录态工具：跳转登录页、清除本地 cookie。供 axios 401 拦截与「退出登录」共用。

/**
 * 跳转登录页（hash 路由）。
 * 不做回跳参数：受保护路由统一由 RequireAuth 守卫拦截，登录成功固定回 /dashboard。
 */
export function redirectToLogin(): void {
  // 已在登录页则不再跳转（用当前 hash 判断，避免并发 401 反复触发）
  if (window.location.hash.startsWith('#/login')) return
  window.location.replace(`${import.meta.env.BASE_URL}#/login`)
}

/** 清除本域 JS 可见 cookie（覆盖常见 path/domain 变体）；httpOnly cookie 由后端退出接口清除 */
export function clearCookies(): void {
  // 应用基路径（/hip 或 /dev/hip），cookie 可能按该 path 或根路径作用域设置
  const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'
  const paths = ['/', basePath]
  const domain = window.location.hostname.startsWith('.')
    ? window.location.hostname
    : `.${window.location.hostname}`
  document.cookie.split(';').forEach((part) => {
    const name = part.split('=')[0]?.trim()
    if (!name) return
    paths.forEach((path) => {
      // 同 path 分别用「精确域名」与「带点域名」各清一遍，覆盖子域设置的 cookie
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`
    })
  })
}
