import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'

import { redirectToLogin } from '@/utils/auth'
import { message } from '@/utils/message'

const REQUEST_TIMEOUT = 15_000

/** 请求配置扩展：silent 跳过全局消息提示（轮询等场景），successMessage 覆盖默认成功文案 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 跳过全局成功/失败消息提示（轮询接口传 true） */
  silent?: boolean
  /** 自定义成功提示文案（默认取后端返回的 msg） */
  successMessage?: string
}

/** 需要弹成功提示的写方法（GET 查询成功不提示，避免搜索/翻页/刷新时反复弹窗） */
const SUCCESS_NOTIFY_METHODS = new Set(['post', 'put', 'delete'])

/**
 * 写操作成功后弹提示：文案取后端返回的 msg，不写死提示语。
 * silent 跳过；successMessage 可覆盖；msg 为空则不提示。
 */
function notifySuccess(
  serverMsg: string | undefined,
  config: RequestConfig | undefined,
  method: string | undefined,
) {
  if (config?.silent || !method || !SUCCESS_NOTIFY_METHODS.has(method)) return
  const text = config?.successMessage ?? serverMsg
  if (text) message.success(text)
}

/** 业务错误：code 非 0/200，或 HTTP 层错误 */
export class ApiError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 把 HTTP 层错误翻译成可读文案 */
function resolveErrorMessage(error: AxiosError): string {
  const status = error.response?.status
  const data = error.response?.data as
    | { msg?: string }
    | undefined
  const serverMessage = data?.msg ||''

  if (serverMessage) return serverMessage
  if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试'
  if (!error.response) return '网络异常，请检查网络连接'
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 403) return '没有权限执行此操作'
  if (status === 404) return '请求的接口不存在'
  return `请求失败（HTTP ${status ?? '未知'}）`
}

const apiBaseKey = import.meta.env.VITE_API_BASE_KEY
// dev 走 Vite dev proxy（同源路径保证 cookie）；生产拼后端完整地址直连
const baseURL = import.meta.env.DEV
  ? apiBaseKey
  : `${import.meta.env.VITE_API_BASE_URL}${apiBaseKey}`

/** 去掉 /api 段的服务前缀：'/dev/hip/api' → '/dev/hip'，供挂在非 /api 上下文（如 /hip/wx）的接口使用 */
const serviceBaseKey = (apiBaseKey ?? '').replace(/\/api$/, '')
export function getServiceBaseURL() {
  return import.meta.env.DEV
    ? serviceBaseKey
    : `${import.meta.env.VITE_API_BASE_URL}${serviceBaseKey}`
}

/** axios 实例使用的接口前缀，供无法走 axios 的请求复用（如 SSE 流式接口用 fetch 消费 ReadableStream） */
export function getApiBaseURL() {
  return baseURL
}

export const http = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true, // cookie 鉴权：跨域请求也要携带凭证
})

// 响应拦截器：解包 { code, data, msg }，非 0/200 抛 ApiError
// 成功/失败都会统一消息提示（轮询等静默请求传 { silent: true } 跳过）
http.interceptors.response.use(
  (response) => {
    const config = response.config as RequestConfig
    const method = config?.method?.toLowerCase()
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0 || body.code === 200) {
        notifySuccess(body.msg, config, method)
        // 成功：优先返回 data，无 data 时透传整个响应体
        return 'data' in body ? body.data : body
      }
      // 业务错误（HTTP 2xx + 业务码非 0/200）：此处 reject 不会走进下方 rejected 处理器，
      // 需手动弹失败提示，否则该错误会静默
      const errorMessage = body.msg ?? '请求失败'
      if (!config?.silent) message.error(errorMessage)
      return Promise.reject(new ApiError(body.code, errorMessage))
    }
    // 兼容后端未按包裹格式返回的情况，视为成功直接透传（无 msg，写操作不提示）
    notifySuccess(undefined, config, method)
    return body
  },
  (error: AxiosError) => {
    const config = error.config as RequestConfig | undefined
    const errorMessage = resolveErrorMessage(error)
    if (!config?.silent) message.error(errorMessage)
    if (error.response?.status === 401) {
      // cookie 鉴权失效：httpOnly cookie 无法由 JS 清除，直接跳转登录页
      redirectToLogin()
    }
    return Promise.reject(
      new ApiError(error.response?.status ?? -1, errorMessage),
    )
  },
)

// 响应拦截器已把 data 解出，这里用 axios 的 R 泛型声明实际返回类型
export const request = <T>(config: RequestConfig) =>
  http.request<unknown, T>(config)

export const get = <T>(url: string, config?: RequestConfig) =>
  http.get<T, T>(url, config)

export const post = <T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
) => http.post<T, T>(url, data, config)

export const put = <T>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
) => http.put<T, T>(url, data, config)

export const del = <T>(url: string, config?: RequestConfig) =>
  http.delete<T, T>(url, config)
