/** 后端统一响应包裹格式：{ code, data, message }，code=0 或 200 为成功 */
export interface ApiResponse<T> {
  code: number
  data: T
  message?: string
  timestamp:number
}

/** 分页请求参数 */
export interface PageParams {
  page: number
  pageSize: number
}

/** 分页响应数据（默认归一化结构，后端实际结构可在 hook 的 select 中覆盖） */
export interface PageResult<T> {
  list: T[]
  total: number
}

/** 队列任务计数（GET /.../queue/status 返回的 data） */
export interface QueueStatus {
  /** 等待中任务数 */
  pending: number
  /** 运行中任务数 */
  running: number
  /** 总任务数 */
  total: number
}
