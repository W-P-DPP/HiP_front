import type {
  VlmBatchTask,
  VlmBatchTaskAccepted,
  VlmBatchTaskQueue,
} from '@/types/vlm-batch'
import { get, post } from '@/utils/axios'

export const vlmBatchQueryKeys = {
  /** 单条批量图像识别任务详情（GET /vlmBatch/tasks/:id） */
  taskDetail: (taskId: string) => ['vlm-batch', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['vlm-batch', 'tasks', taskId, 'queue'] as const,
}

/** 创建批量图像识别任务的入参 */
export interface CreateVlmBatchTaskParams {
  /** 已完成的抽帧任务 id */
  taskId: string
  /** 整批共用的输出模式：json / text，缺省由后端取默认 */
  mode?: string
  /** 整批共用的提示词，缺省由后端取默认 */
  prompt?: string
}

/**
 * 基于抽帧任务创建批量图像识别任务（POST /vlmBatch/tasks）。
 * 只建任务并返回 taskId，识别由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 不传 silent：成功提示取后端返回的 msg。
 */
export const createVlmBatchTask = (
  params: CreateVlmBatchTaskParams,
): Promise<VlmBatchTaskAccepted> => post<VlmBatchTaskAccepted>('/vlmBatch/tasks', params)

/**
 * 查询批量图像识别任务详情与进度（GET /vlmBatch/tasks/:id），成功后含逐项结果 items。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getVlmBatchTaskDetail = (taskId: string): Promise<VlmBatchTask> =>
  get<VlmBatchTask>(`/vlmBatch/tasks/${taskId}`, { silent: true })

/**
 * 查询批量图像识别任务在当前用户队列中的位置（GET /vlmBatch/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getVlmBatchTaskDetail 轮询进度。
 */
export const getVlmBatchTaskQueue = (taskId: string): Promise<VlmBatchTaskQueue> =>
  get<VlmBatchTaskQueue>(`/vlmBatch/tasks/${taskId}/queue`, { silent: true })
