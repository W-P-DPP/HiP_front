import type { PageResult, QueueStatus } from '@/types/api'
import type {
  VideoPipelineV2Task,
  VideoPipelineV2TaskAccepted,
  VideoPipelineV2TaskQueue,
  VideoPipelineV2TaskStatus,
} from '@/types/video-pipeline-v2'
import { get, post } from '@/utils/axios'

export const videoPipelineV2QueryKeys = {
  /** 短视频合成记录列表（GET /videoPipelineV2/tasks，按 status 过滤） */
  tasks: ['video-pipeline-v2', 'tasks'] as const,
  /** 单条短视频合成任务详情（GET /videoPipelineV2/tasks/:id） */
  taskDetail: (id: string) => ['video-pipeline-v2', 'tasks', id] as const,
  /** 单个任务的排队位置（短视频工厂轮询，任务出队执行后停止） */
  taskQueue: (taskId: string) => ['video-pipeline-v2', 'tasks', taskId, 'queue'] as const,
  /** 某任务的 SRT 文本（在线预览） */
  srtText: (taskId: string) => ['video-pipeline-v2', 'tasks', taskId, 'srt'] as const,
  /** 短视频合成任务队列计数（GET /videoPipelineV2/tasks/queue/status） */
  queueStatus: ['video-pipeline-v2', 'tasks', 'queue-status'] as const,
}

/** 分页查询短视频合成任务参数（GET /videoPipelineV2/tasks） */
export interface GetVideoPipelineV2TasksParams {
  /** 按状态过滤：pending / running / success / failed，不传为全部 */
  status?: VideoPipelineV2TaskStatus
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

/**
 * 分页查询短视频合成记录（GET /videoPipelineV2/tasks）。
 * status 为唯一可选过滤条件，不传表示查全部；后端按当前登录用户过滤。
 * 该接口被记录页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏。
 */
export const getVideoPipelineV2TaskList = (params: GetVideoPipelineV2TasksParams) =>
  get<PageResult<VideoPipelineV2Task>>('/videoPipelineV2/tasks', { params, silent: true })

/**
 * 查询单条短视频合成任务详情（GET /videoPipelineV2/tasks/:id）。
 * 与列表元素同构，返回该任务的最新快照。
 */
export const getVideoPipelineV2TaskDetail = (id: string): Promise<VideoPipelineV2Task> =>
  get<VideoPipelineV2Task>(`/videoPipelineV2/tasks/${id}`, { silent: true })

/** 查询短视频合成任务队列计数（轮询使用，silent 跳过全局成功/失败消息） */
export const getVideoPipelineV2QueueStatus = (): Promise<QueueStatus> =>
  get<QueueStatus>('/videoPipelineV2/tasks/queue/status', { silent: true })

/** 提交视频合成任务参数（POST /videoPipelineV2/tasks/compose） */
export interface CreateVideoPipelineV2ComposeParams {
  /** 上一步音频合成产物的 file 记录 id */
  audioFileId: string
  /** 上一步字幕生成产物的 SRT file 记录 id */
  srtFileId: string
  /** 音色库记录 id */
  voiceId: string
  /** 待合成文本 */
  text: string
  /** 速度档位：fast / balanced / quality */
  speedMode: string
  /** 每段字幕对应的素材搜索词 */
  keywords: string[]
}

/**
 * 提交视频合成任务（POST /videoPipelineV2/tasks/compose）。
 * 只建任务并返回 taskId，合成由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 成功提示由 axios 拦截器统一处理，故不传 silent。
 */
export const composeVideoPipelineV2Task = (
  params: CreateVideoPipelineV2ComposeParams,
): Promise<VideoPipelineV2TaskAccepted> =>
  post<VideoPipelineV2TaskAccepted>('/videoPipelineV2/tasks/compose', params)

/**
 * 查询视频合成任务在当前用户队列中的位置（GET /videoPipelineV2/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getVideoPipelineV2TaskDetail 轮询进度。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getVideoPipelineV2TaskQueue = (taskId: string): Promise<VideoPipelineV2TaskQueue> =>
  get<VideoPipelineV2TaskQueue>(`/videoPipelineV2/tasks/${taskId}/queue`, { silent: true })

/**
 * 取消排队中的短视频合成任务（POST /videoPipelineV2/tasks/:taskId/cancel）。
 * 仅 pending 任务可取消，成功提示由 axios 拦截器统一处理。
 */
export const cancelVideoPipelineV2Task = (taskId: string): Promise<void> =>
  post<void>(`/videoPipelineV2/tasks/${taskId}/cancel`)
