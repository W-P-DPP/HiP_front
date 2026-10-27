import type { PageResult } from '@/types/api'
import type {
  DetectOptions,
  MergeScenesParams,
  SceneSplitTask,
  SceneSplitTaskAccepted,
  SceneSplitTaskQueue,
  SceneSplitTaskStatus,
} from '@/types/scene-split'
import { get, post } from '@/utils/axios'

export const sceneSplitQueryKeys = {
  /** 当前用户的场景切分任务列表（GET /aiDetect/scene/tasks） */
  tasks: ['scene-split', 'tasks'] as const,
  /** 单条场景切分任务详情（GET /aiDetect/scene/tasks/:id） */
  taskDetail: (taskId: string) => ['scene-split', 'tasks', taskId] as const,
  /** 单个任务的排队位置（任务出队执行后停止轮询） */
  taskQueue: (taskId: string) => ['scene-split', 'tasks', taskId, 'queue'] as const,
}

/** 场景切分任务分页查询参数 */
export interface GetSceneSplitTaskListParams {
  page: number
  /** 后端分页参数名是 limit，不是 pageSize */
  limit: number
  /** 任务状态筛选，不传为全部 */
  status?: SceneSplitTaskStatus
}

/**
 * 查询当前用户的场景切分任务列表（GET /aiDetect/scene/tasks）。
 * 列表轮询接口传 silent：失败不弹全局提示。
 * 记录列表耗时较长，超时放宽到 60s。
 */
export const getSceneSplitTaskList = (params: GetSceneSplitTaskListParams) =>
  get<PageResult<SceneSplitTask>>('/aiDetect/scene/tasks', {
    params,
    silent: true,
    timeout: 60_000,
  })

/** 创建场景切分任务的入参：fileId 必填，检测参数可选（缺省由后端取推荐值） */
export interface CreateSceneSplitTaskParams extends DetectOptions {
  /** 素材库视频的 file 记录 id */
  fileId: string
}

/**
 * 从素材库视频创建场景切分任务（POST /aiDetect/scene/tasks）。
 * 只建任务并返回 taskId，切分由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 不传 successMessage：成功提示取后端返回的 msg（「场景切分任务已提交」）。
 */
export const createSceneSplitTask = (
  params: CreateSceneSplitTaskParams,
): Promise<SceneSplitTaskAccepted> => post<SceneSplitTaskAccepted>('/aiDetect/scene/tasks', params)

/**
 * 查询场景切分任务详情与进度（GET /aiDetect/scene/tasks/:id），成功后含 scenes。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getSceneSplitTaskDetail = (taskId: string): Promise<SceneSplitTask> =>
  get<SceneSplitTask>(`/aiDetect/scene/tasks/${taskId}`, { silent: true })

/**
 * 查询场景切分任务在当前用户队列中的位置（GET /aiDetect/scene/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getSceneSplitTaskDetail 轮询进度。
 */
export const getSceneSplitTaskQueue = (taskId: string): Promise<SceneSplitTaskQueue> =>
  get<SceneSplitTaskQueue>(`/aiDetect/scene/tasks/${taskId}/queue`, { silent: true })

/**
 * 合并场景（POST /aiDetect/scene/tasks/:taskId/merge）。
 * groups 的每组必须是一段连续的场景序号；合并不可撤销。
 * 响应体不作为结果来源（故返回类型取 void），合并后需重新拉取任务详情取最新 scenes。
 */
export const mergeScenes = (taskId: string, params: MergeScenesParams): Promise<void> =>
  post<void>(`/aiDetect/scene/tasks/${taskId}/merge`, params)
