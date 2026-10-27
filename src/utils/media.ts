/** 与 utils/axios 的 baseURL 推导一致：dev 走同源代理前缀，prod 拼完整服务前缀 */
const FILE_BASE = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_KEY
  : `${import.meta.env.VITE_API_BASE_URL}${import.meta.env.VITE_API_BASE_KEY}`

/**
 * 后端返回的文件地址（audioUrl/videoUrl/srtUrl 等）是缺服务前缀的相对路径
 * （如 /api/files/<id>/download），直接作 src 会 404；此处把 /api 前缀替换成
 * 应用实际的文件服务基址（对应 utils/axios 的 baseURL），完整地址（http/blob/data 等）原样返回。
 */
export function resolveMediaUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('/api/')) return `${FILE_BASE}${url.replace(/^\/api/, '')}`
  return url
}
