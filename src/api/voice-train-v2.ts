import type { PageResult, QueueStatus } from '@/types/api'
import type {
  VoiceTrainV2SynthesisQueue,
  VoiceTrainV2SynthesisRecord,
  VoiceTrainV2SynthesisStatus,
  VoiceTrainV2SynthesisTask,
  VoiceTrainV2SynthesizeAccepted,
  VoiceTrainV2SpeedMode,
  VoiceTrainV2Voice,
} from '@/types/voice-train-v2'
import { del, get, post, put } from '@/utils/axios'

export const voiceTrainV2QueryKeys = {
  voices: ['voice-train-v2', 'voices'] as const,
  /** 未过滤的音色总数（判断 user 是否已达上限），与列表 key 分开避免被搜索条件污染 */
  voiceCount: ['voice-train-v2', 'voices', 'count'] as const,
  /** 单个合成任务的进度（按 taskId 隔离，避免多个任务互相覆盖缓存） */
  synthesisTask: (taskId: string) => ['voice-train-v2', 'synthesis-task', taskId] as const,
  /** 单个合成任务的排队位置（按 taskId 隔离，10s 内被任务进度轮询取代） */
  synthesisQueue: (taskId: string) =>
    ['voice-train-v2', 'synthesis-queue', taskId] as const,
  /** 音色合成记录列表（GET /voiceTrainV2/synthesize，按 status 过滤） */
  synthesisRecords: ['voice-train-v2', 'synthesis-records'] as const,
  /** 单条音色合成记录详情（GET /voiceTrainV2/synthesize/:id） */
  synthesisRecordDetail: (id: string) =>
    ['voice-train-v2', 'synthesis-records', id] as const,
  /** 音色合成任务队列计数（GET /voiceTrainV2/synthesize/queue/status） */
  queueStatus: ['voice-train-v2', 'synthesize', 'queue-status'] as const,
}

/** 上传音频需先经 ffmpeg 归一化，体积可达 MB 级，默认 15s 超时偏紧，单独放宽 */
const UPLOAD_TIMEOUT = 60_000

/**
 * 分页查询音色（GET /voiceTrainV2/voices）。
 * 注意：后端不会按当前用户自动过滤，userId 必须显式传入。
 * 该接口被列表页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏（错误由表格内联展示）。
 */
export interface GetVoiceTrainV2VoicesParams {
  userId: string
  /** 音色名称模糊搜索关键字 */
  resourceName?: string
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

export const getVoiceTrainV2Voices = (params: GetVoiceTrainV2VoicesParams) =>
  get<PageResult<VoiceTrainV2Voice>>('/voiceTrainV2/voices', { params, silent: true })

/** 上传音频并创建音色（POST /voiceTrainV2/voices，multipart/form-data） */
export interface UploadVoiceTrainV2VoiceParams {
  /** 音频文件，后端字段名固定为 file */
  file: File
  resourceName: string
  userId: string
}

export const uploadVoiceTrainV2Voice = (
  params: UploadVoiceTrainV2VoiceParams,
): Promise<VoiceTrainV2Voice> => {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('resourceName', params.resourceName)
  formData.append('userId', params.userId)
  return post<VoiceTrainV2Voice>('/voiceTrainV2/voices', formData, {
    timeout: UPLOAD_TIMEOUT,
  })
}

/** 修改音色名称（PUT /voiceTrainV2/voices/:id，仅允许修改 resourceName 且仅限本人音色） */
export const updateVoiceTrainV2VoiceName = ({
  id,
  resourceName,
}: {
  id: string
  resourceName: string
}): Promise<VoiceTrainV2Voice> =>
  put<VoiceTrainV2Voice>(`/voiceTrainV2/voices/${id}`, { resourceName })

/** 删除音色（DELETE /voiceTrainV2/voices/:id，后端为假删除且仅限本人音色） */
export const deleteVoiceTrainV2Voice = (id: string): Promise<true> =>
  del<true>(`/voiceTrainV2/voices/${id}`)

/**
 * 提交试听合成任务（POST /voiceTrainV2/synthesize）。
 *
 * 只建 pending 任务并把 taskId 返回，真正的合成由后端 GPU 调度器串行执行，
 * 需轮询 getVoiceTrainV2SynthesisTask 取进度。text/speedMode 不传由后端取默认试听文案与 balanced 档。
 *
 * purpose 必须显式传 preview：后端缺省取 synthesis（正式合成），该用途**不会**把产物回写到
 * 音色的 previewUrl，列表里的「试听」将永远拿不到音频。
 */
export const synthesizeVoiceTrainV2Preview = ({
  voiceId,
  userId,
}: {
  voiceId: string
  userId: string
}): Promise<VoiceTrainV2SynthesizeAccepted> =>
  post<VoiceTrainV2SynthesizeAccepted>('/voiceTrainV2/synthesize', {
    voiceId,
    purpose: 'preview',
    userId,
  })

/**
 * 提交正式合成任务（POST /voiceTrainV2/synthesize）。
 *
 * 与试听合成为同一接口，仅请求体不同：purpose 缺省即 synthesis（正式合成），故此处只传
 * voiceId/text/speedMode 三字段。同样只建 pending 任务，需轮询任务状态取进度与产物地址。
 */
export interface SynthesizeVoiceTrainV2Params {
  voiceId: string
  /** 待合成文案 */
  text: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
}

export const synthesizeVoiceTrainV2 = (
  params: SynthesizeVoiceTrainV2Params,
): Promise<VoiceTrainV2SynthesizeAccepted> =>
  post<VoiceTrainV2SynthesizeAccepted>('/voiceTrainV2/synthesize', params)

/**
 * 查询合成任务进度（GET /voiceTrainV2/synthesize/:taskId）。
 * 轮询接口传 silent：进度查询成功/失败都不弹全局提示，由调用方按终态自行提示。
 */
export const getVoiceTrainV2SynthesisTask = (
  taskId: string,
): Promise<VoiceTrainV2SynthesisTask> =>
  get<VoiceTrainV2SynthesisTask>(`/voiceTrainV2/synthesize/${taskId}`, { silent: true })

/**
 * 查询合成任务在当前用户队列中的位置（GET /voiceTrainV2/synthesize/:taskId/queue）。
 * 任务出队执行后 position 为 null，需改用 getVoiceTrainV2SynthesisTask 轮询进度。
 * 轮询接口传 silent：失败不弹全局提示。
 */
export const getVoiceTrainV2SynthesisQueue = (
  taskId: string,
): Promise<VoiceTrainV2SynthesisQueue> =>
  get<VoiceTrainV2SynthesisQueue>(`/voiceTrainV2/synthesize/${taskId}/queue`, { silent: true })

/**
 * 分页查询合成记录（GET /voiceTrainV2/synthesize）。
 * status 为唯一可选过滤条件，不传表示查全部；后端按当前登录用户过滤。
 * 该接口被记录页 10s 轮询，传 silent：失败不弹全局提示，避免网络波动时反复刷屏。
 */
export interface GetVoiceTrainV2SynthesisListParams {
  /** 按状态过滤：pending / running / success / failed，不传为全部 */
  status?: VoiceTrainV2SynthesisStatus
  page: number
  /** 后端分页参数名为 limit，不是 pageSize */
  limit: number
}

export const getVoiceTrainV2SynthesisList = (params: GetVoiceTrainV2SynthesisListParams) =>
  get<PageResult<VoiceTrainV2SynthesisRecord>>('/voiceTrainV2/synthesize', {
    params,
    silent: true,
  })

/**
 * 查询单条合成记录详情（GET /voiceTrainV2/synthesize/:id）。
 * 与列表元素同构，返回该任务的最新快照。
 */
export const getVoiceTrainV2SynthesisRecordDetail = (
  id: string,
): Promise<VoiceTrainV2SynthesisRecord> =>
  get<VoiceTrainV2SynthesisRecord>(`/voiceTrainV2/synthesize/${id}`)

/** 查询音色合成任务队列计数（轮询使用，silent 跳过全局成功/失败消息） */
export const getVoiceTrainV2QueueStatus = (): Promise<QueueStatus> =>
  get<QueueStatus>('/voiceTrainV2/synthesize/queue/status', { silent: true })

/**
 * 取消排队中的音色合成任务（POST /voiceTrainV2/synthesize/:taskId/cancel）。
 * 仅 pending 任务可取消，成功提示由 axios 拦截器统一处理。
 */
export const cancelVoiceTrainV2Synthesis = (taskId: string): Promise<void> =>
  post<void>(`/voiceTrainV2/synthesize/${taskId}/cancel`)
