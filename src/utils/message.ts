import { toast } from 'sonner'

/**
 * 全局消息提示公共组件（基于 sonner）。
 * 正常请求的成功/失败提示由 axios 拦截器统一调用（见 src/utils/axios.ts），
 * 轮询等静默请求传 { silent: true } 跳过；这里仅供页面/组件按需手动触发。
 */
export const message = {
  success: (content: string) => toast.success(content),
  error: (content: string) => toast.error(content),
  info: (content: string) => toast.info(content),
  warning: (content: string) => toast.warning(content),
}
