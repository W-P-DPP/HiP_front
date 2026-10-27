import type {
  FrameExtractTask,
  FrameExtractTaskAccepted,
  FrameExtractTaskQueue,
} from '@/types/frame-extract'
import { get, post } from '@/utils/axios'

export const frameExtractQueryKeys = {
  /** 单条抽帧任务详情（GET /aiDetect/frames/tasks/:id） */
  taskDetail: (taskId: string) => ['frame-extract', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['frame-extract', 'tasks', taskId, 'queue'] as const,
}

/** 创建抽帧任务的入参：taskId 为场景切分任务 id */
export interface CreateFrameExtractTaskParams {
  /** 来源场景切分任务 id */
  taskId: string
}

/**
 * 从场景切分任务创建抽帧任务（POST /aiDetect/frames/tasks）。
 * 只建任务并返回 taskId，抽帧由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 不传 silent：成功提示取后端返回的 msg。
 */
export const createFrameExtractTask = (
  params: CreateFrameExtractTaskParams,
): Promise<FrameExtractTaskAccepted> =>
  post<FrameExtractTaskAccepted>('/aiDetect/frames/tasks', params)

/**
 * 查询抽帧任务详情与进度（GET /aiDetect/frames/tasks/:id），成功后含 frames。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getFrameExtractTaskDetail = (taskId: string): Promise<FrameExtractTask> =>
  get<FrameExtractTask>(`/aiDetect/frames/tasks/${taskId}`, { silent: true })

/**
 * 查询抽帧任务在当前用户队列中的位置（GET /aiDetect/frames/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getFrameExtractTaskDetail 轮询进度。
 */
export const getFrameExtractTaskQueue = (taskId: string): Promise<FrameExtractTaskQueue> =>
  get<FrameExtractTaskQueue>(`/aiDetect/frames/tasks/${taskId}/queue`, { silent: true })
