import { del, get, post, put } from '@/utils/axios'

import type { PageResult, QueueStatus } from '@/types/api'
import type {
  CreateDigitalHumanTaskParams,
  DigitalHumanAvatar,
  DigitalHumanSynthesisRecord,
  DigitalHumanSynthesisStatus,
  DigitalHumanTaskAccepted,
  DigitalHumanTaskQueue,
} from '@/types/digital-human'

export const digitalHumanQueryKeys = {
  avatars: ['digital-human', 'avatars'] as const,
  /** 数字人合成记录列表（GET /digitalHuman/tasks，按 status 过滤） */
  tasks: ['digital-human', 'tasks'] as const,
  /** 单条数字人合成任务详情（GET /digitalHuman/tasks/:id） */
  taskDetail: (id: string) => ['digital-human', 'tasks', id] as const,
  /** 单条数字人合成任务的队列位置（GET /digitalHuman/tasks/:id/queue） */
  taskQueue: (id: string) => ['digital-human', 'tasks', id, 'queue'] as const,
  /** 合成任务烧录字幕的 SRT 文本（在线预览） */
  srtText: (taskId: string) => ['digital-human', 'tasks', taskId, 'srt'] as const,
  /** 数字人合成任务队列计数（GET /digitalHuman/tasks/queue/status） */
  queueStatus: ['digital-human', 'tasks', 'queue-status'] as const,
}

/** 上传视频含转码，默认 15s 超时偏紧，单独放宽 */
const UPLOAD_TIMEOUT = 60_000

/** 分页查询数字人列表参数（GET /digitalHuman/avatars） */
export interface GetDigitalHumanAvatarListParams {
  /** 归属用户 id */
  userId: string
  /** 数字人名称模糊搜索关键字 */
  name?: string
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

/**
 * 分页查询当前用户的数字人列表。
 * 该接口被列表页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏（错误由表格内联展示）。
 */
export const getDigitalHumanAvatarList = (
  params: GetDigitalHumanAvatarListParams,
) => get<PageResult<DigitalHumanAvatar>>('/digitalHuman/avatars', { params, silent: true })

/** 创建数字人（POST /digitalHuman/avatars，multipart/form-data） */
export interface CreateDigitalHumanAvatarParams {
  /** 视频文件，后端字段名固定为 file */
  file: File
  name: string
  userId: string
}

export const createDigitalHumanAvatar = (
  params: CreateDigitalHumanAvatarParams,
): Promise<DigitalHumanAvatar> => {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('name', params.name)
  formData.append('userId', params.userId)
  return post<DigitalHumanAvatar>('/digitalHuman/avatars', formData, {
    timeout: UPLOAD_TIMEOUT,
  })
}

/** 修改数字人名称（PUT /digitalHuman/avatars/:id，仅允许修改 name） */
export const updateDigitalHumanAvatarName = (
  id: string,
  name: string,
): Promise<DigitalHumanAvatar> =>
  put<DigitalHumanAvatar>(`/digitalHuman/avatars/${id}`, { name })

/** 删除数字人（DELETE /digitalHuman/avatars/:id） */
export const deleteDigitalHumanAvatar = (id: string): Promise<void> =>
  del<void>(`/digitalHuman/avatars/${id}`)

/** 分页查询数字人合成记录参数（GET /digitalHuman/tasks） */
export interface GetDigitalHumanTaskListParams {
  /** 按状态过滤：pending / running / success / failed，不传为全部 */
  status?: DigitalHumanSynthesisStatus
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

/**
 * 分页查询数字人合成任务（GET /digitalHuman/tasks）。
 * status 为唯一可选过滤条件，不传表示查全部；后端按当前登录用户过滤。
 * 该接口被记录页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏。
 */
export const getDigitalHumanTaskList = (params: GetDigitalHumanTaskListParams) =>
  get<PageResult<DigitalHumanSynthesisRecord>>('/digitalHuman/tasks', {
    params,
    silent: true,
  })

/**
 * 查询单条数字人合成任务详情（GET /digitalHuman/tasks/:id）。
 * 与列表元素同构，返回该任务的最新快照。
 */
export const getDigitalHumanTaskDetail = (
  id: string,
): Promise<DigitalHumanSynthesisRecord> =>
  get<DigitalHumanSynthesisRecord>(`/digitalHuman/tasks/${id}`)

/** 查询数字人合成任务队列计数（轮询使用，silent 跳过全局成功/失败消息） */
export const getDigitalHumanQueueStatus = (): Promise<QueueStatus> =>
  get<QueueStatus>('/digitalHuman/tasks/queue/status', { silent: true })

/**
 * 取消排队中的数字人合成任务（POST /digitalHuman/tasks/:taskId/cancel）。
 * 仅 pending 任务可取消，成功提示由 axios 拦截器统一处理。
 */
export const cancelDigitalHumanTask = (taskId: string): Promise<void> =>
  post<void>(`/digitalHuman/tasks/${taskId}/cancel`)

/**
 * 提交数字人视频合成任务（POST /digitalHuman/tasks/with-subtitle）。
 * 音频由后端按 text + voiceId 重建，字幕烧录由后端按 subtitleId 取 SRT 完成。
 * 只建任务并返回 taskId，合成由后端调度器串行执行，需轮询排队位置与任务状态取进度。
 * 成功提示由 axios 拦截器统一处理，故不传 silent。
 */
export const createDigitalHumanTask = (
  params: CreateDigitalHumanTaskParams,
): Promise<DigitalHumanTaskAccepted> =>
  post<DigitalHumanTaskAccepted>('/digitalHuman/tasks/with-subtitle', params)

/**
 * 查询数字人合成任务在当前用户队列中的位置（GET /digitalHuman/tasks/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getDigitalHumanTaskDetail 轮询进度。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getDigitalHumanTaskQueue = (
  taskId: string,
): Promise<DigitalHumanTaskQueue> =>
  get<DigitalHumanTaskQueue>(`/digitalHuman/tasks/${taskId}/queue`, { silent: true })
