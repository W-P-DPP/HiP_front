import type {
  VlmTask,
  VlmTaskAccepted,
  VlmTaskMode,
  VlmTaskQueue,
} from '@/types/vlm'
import { get, post } from '@/utils/axios'

/** 上传超时（图片可能较大，放宽到 60s） */
const UPLOAD_TIMEOUT = 60_000

export const vlmQueryKeys = {
  /** 单条图像理解任务详情（GET /vlm/tasks/:id） */
  taskDetail: (taskId: string) => ['vlm', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['vlm', 'tasks', taskId, 'queue'] as const,
}

/** 创建图像理解任务的可选参数（不传时由后端取默认提示词与模式） */
export interface CreateVlmTaskOptions {
  /** 自定义提示词 */
  prompt?: string
  /** 输出模式 */
  mode?: VlmTaskMode
}

/**
 * 从本地图像创建图像理解任务（POST /vlm/tasks）。
 * multipart 直传，FormData 字段名 file，可选附带 prompt/mode；
 * 返回 taskId 后轮询排队位置与任务状态取进度。
 */
export const createVlmTaskFromMedia = (
  file: File,
  options: CreateVlmTaskOptions = {},
): Promise<VlmTaskAccepted> => {
  const formData = new FormData()
  formData.append('file', file)
  if (options.prompt) formData.append('prompt', options.prompt)
  if (options.mode) formData.append('mode', options.mode)
  return post<VlmTaskAccepted>('/vlm/tasks', formData, { timeout: UPLOAD_TIMEOUT })
}

/**
 * 从素材库图像创建图像理解任务（POST /vlm/tasks）。
 * JSON 入参 { fileId }，可选附带 prompt/mode。
 */
export const createVlmTaskFromMaterial = (
  fileId: string,
  options: CreateVlmTaskOptions = {},
): Promise<VlmTaskAccepted> =>
  post<VlmTaskAccepted>('/vlm/tasks', {
    fileId,
    ...(options.prompt ? { prompt: options.prompt } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
  })

/**
 * 查询图像理解任务详情与进度（GET /vlm/tasks/:id），成功后含 result。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getVlmTaskDetail = (taskId: string): Promise<VlmTask> =>
  get<VlmTask>(`/vlm/tasks/${taskId}`, { silent: true })

/**
 * 查询图像理解任务在当前用户队列中的位置（GET /vlm/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getVlmTaskDetail 轮询进度。
 */
export const getVlmTaskQueue = (taskId: string): Promise<VlmTaskQueue> =>
  get<VlmTaskQueue>(`/vlm/tasks/${taskId}/queue`, { silent: true })
