import type { PageResult } from '@/types/api'
import type {
  CreateNarrationVideoTaskParams,
  NarrationVideoTask,
  NarrationVideoTaskAccepted,
  NarrationVideoTaskQueue,
  NarrationVideoTaskStatus,
} from '@/types/narration-video'
import { get, post } from '@/utils/axios'

export const narrationVideoQueryKeys = {
  /** 当前用户的视频解说任务列表（GET /narrationVideo/tasks） */
  tasks: ['narration-video', 'tasks'] as const,
  /** 单条视频解说任务详情（GET /narrationVideo/tasks/:id） */
  taskDetail: (taskId: string) => ['narration-video', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['narration-video', 'tasks', taskId, 'queue'] as const,
}

/**
 * 提交视频解说任务（POST /narrationVideo/tasks）。
 * 只建 pending 任务并返回 taskId，合成由后端 GPU 调度器串行执行，需轮询排队位置与任务状态取进度。
 * 不传 successMessage：成功提示取后端返回的 msg。
 */
export const createNarrationVideoTask = (
  params: CreateNarrationVideoTaskParams,
): Promise<NarrationVideoTaskAccepted> =>
  post<NarrationVideoTaskAccepted>('/narrationVideo/tasks', params)

/**
 * 查询视频解说任务详情与进度（GET /narrationVideo/tasks/:taskId），成功后含成品视频与字幕产物。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getNarrationVideoTaskDetail = (
  taskId: string,
): Promise<NarrationVideoTask> =>
  get<NarrationVideoTask>(`/narrationVideo/tasks/${taskId}`, { silent: true })

/**
 * 查询视频解说任务在当前用户队列中的位置（GET /narrationVideo/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getNarrationVideoTaskDetail 轮询进度。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getNarrationVideoTaskQueue = (
  taskId: string,
): Promise<NarrationVideoTaskQueue> =>
  get<NarrationVideoTaskQueue>(`/narrationVideo/tasks/${taskId}/queue`, { silent: true })

/** 视频解说任务分页查询参数 */
export interface GetNarrationVideoTaskListParams {
  page: number
  /** 后端分页参数名是 limit，不是 pageSize */
  limit: number
  /** 任务状态筛选，不传为全部 */
  status?: NarrationVideoTaskStatus
}

/**
 * 查询当前用户的视频解说任务列表（GET /narrationVideo/tasks）。
 * 列表轮询接口传 silent：失败不弹全局提示，避免网络波动时反复刷屏。
 */
export const getNarrationVideoTaskList = (params: GetNarrationVideoTaskListParams) =>
  get<PageResult<NarrationVideoTask>>('/narrationVideo/tasks', { params, silent: true })
