import type {
  SceneTranscribeTask,
  SceneTranscribeTaskAccepted,
  SceneTranscribeTaskQueue,
} from '@/types/scene-transcribe'
import { get, post } from '@/utils/axios'

export const sceneTranscribeQueryKeys = {
  /** 单条场景转写任务详情（GET /aiDetect/asr/tasks/:id） */
  taskDetail: (taskId: string) => ['scene-transcribe', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['scene-transcribe', 'tasks', taskId, 'queue'] as const,
}

/** 创建场景转写任务的入参：taskId 为场景切分任务 id */
export interface CreateSceneTranscribeTaskParams {
  /** 来源场景切分任务 id */
  taskId: string
}

/**
 * 从场景切分任务创建场景转写任务（POST /aiDetect/asr/tasks）。
 * 只建任务并返回 taskId，转写由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 不传 silent：成功提示取后端返回的 msg。
 */
export const createSceneTranscribeTask = (
  params: CreateSceneTranscribeTaskParams,
): Promise<SceneTranscribeTaskAccepted> =>
  post<SceneTranscribeTaskAccepted>('/aiDetect/asr/tasks', params)

/**
 * 查询场景转写任务详情与进度（GET /aiDetect/asr/tasks/:id），成功后含 sceneSegments。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getSceneTranscribeTaskDetail = (taskId: string): Promise<SceneTranscribeTask> =>
  get<SceneTranscribeTask>(`/aiDetect/asr/tasks/${taskId}`, { silent: true })

/**
 * 查询场景转写任务在当前用户队列中的位置（GET /aiDetect/asr/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getSceneTranscribeTaskDetail 轮询进度。
 */
export const getSceneTranscribeTaskQueue = (taskId: string): Promise<SceneTranscribeTaskQueue> =>
  get<SceneTranscribeTaskQueue>(`/aiDetect/asr/tasks/${taskId}/queue`, { silent: true })
