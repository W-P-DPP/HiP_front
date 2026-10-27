import type { PageResult, QueueStatus } from '@/types/api'
import type {
  SubtitleTask,
  SubtitleTaskAccepted,
  SubtitleTaskQueue,
  SubtitleTaskStatus,
} from '@/types/subtitle'
import { get, post } from '@/utils/axios'

/** 上传超时（音视频文件可能较大，放宽到 60s） */
const UPLOAD_TIMEOUT = 60_000

export const subtitleQueryKeys = {
  /** 字幕合成记录列表（GET /subtitles/tasks，按 status 过滤） */
  tasks: ['subtitles', 'tasks'] as const,
  /** 单条字幕任务详情（GET /subtitles/tasks/:id） */
  taskDetail: (id: string) => ['subtitles', 'tasks', id] as const,
  /** 某任务的 SRT 文本（在线预览） */
  srtText: (taskId: string) => ['subtitles', 'tasks', taskId, 'srt'] as const,
  /** 单个任务的排队位置（短视频工厂轮询，任务出队执行后停止） */
  taskQueue: (taskId: string) => ['subtitles', 'tasks', taskId, 'queue'] as const,
  /** 字幕合成任务队列计数（GET /subtitles/tasks/queue/status） */
  queueStatus: ['subtitles', 'tasks', 'queue-status'] as const,
}

/** 分页查询字幕任务参数（GET /subtitles/tasks） */
export interface GetSubtitleTaskListParams {
  /** 按状态过滤：pending / running / success / failed，不传为全部 */
  status?: SubtitleTaskStatus
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

/**
 * 分页查询字幕合成记录（GET /subtitles/tasks）。
 * status 为唯一可选过滤条件，不传表示查全部；后端按当前登录用户过滤。
 * 该接口被记录页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏。
 */
export const getSubtitleTaskList = (params: GetSubtitleTaskListParams) =>
  get<PageResult<SubtitleTask>>('/subtitles/tasks', { params, silent: true })

/**
 * 查询单条字幕任务详情（GET /subtitles/tasks/:id）。
 * 与列表元素同构，返回该任务的最新快照。
 */
export const getSubtitleTaskDetail = (id: string): Promise<SubtitleTask> =>
  get<SubtitleTask>(`/subtitles/tasks/${id}`, { silent: true })

/** 创建字幕任务参数（POST /subtitles/tasks） */
export interface CreateSubtitleTaskParams {
  /** 源音频 file 记录 id（短视频工厂中来自上一步音频合成的产物） */
  fileId: string
}

/**
 * 创建字幕任务（POST /subtitles/tasks）。
 * 只建任务并返回 taskId，识别由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 */
export const createSubtitleTask = (
  params: CreateSubtitleTaskParams,
): Promise<SubtitleTaskAccepted> => post<SubtitleTaskAccepted>('/subtitles/tasks', params)

/**
 * 从本地音视频创建字幕任务（POST /subtitles/tasks/from-media）。
 * multipart 直传，FormData 字段名 file，支持音频与视频；一步完成「上传 + 建任务」，
 * 返回 taskId 后同样轮询排队位置与任务状态取进度。
 */
export const createSubtitleTaskFromMedia = (file: File): Promise<SubtitleTaskAccepted> => {
  const formData = new FormData()
  formData.append('file', file)
  return post<SubtitleTaskAccepted>('/subtitles/tasks/from-media', formData, {
    timeout: UPLOAD_TIMEOUT,
  })
}

/**
 * 查询字幕任务在当前用户队列中的位置（GET /subtitles/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getSubtitleTaskDetail 轮询进度。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getSubtitleTaskQueue = (taskId: string): Promise<SubtitleTaskQueue> =>
  get<SubtitleTaskQueue>(`/subtitles/tasks/${taskId}/queue`, { silent: true })

/**
 * 拉取 SRT 文本用于在线预览。
 * srtUrl 形如 /api/files/:id/download，去掉 /api 后交给 axios 实例 baseURL（= VITE_API_BASE_KEY）拼前缀，
 * 与 utils/media.ts 的 resolveMediaUrl 同一套前缀推导，dev/prod 均正确。
 * 响应为 text/plain：响应拦截器对非对象 body 原样透传，可直接拿到字符串。
 */
export const getSubtitleSrtText = (srtUrl: string): Promise<string> =>
  get<string>(srtUrl.replace(/^\/api/, ''), { silent: true })

/** 查询字幕合成任务队列计数（轮询使用，silent 跳过全局成功/失败消息） */
export const getSubtitleQueueStatus = (): Promise<QueueStatus> =>
  get<QueueStatus>('/subtitles/tasks/queue/status', { silent: true })

/**
 * 取消排队中的字幕任务（POST /subtitles/tasks/:taskId/cancel）。
 * 仅 pending 任务可取消，成功提示由 axios 拦截器统一处理。
 */
export const cancelSubtitleTask = (taskId: string): Promise<void> =>
  post<void>(`/subtitles/tasks/${taskId}/cancel`)
