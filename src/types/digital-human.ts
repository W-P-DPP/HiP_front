import type { PageResult } from '@/types/api'

/** 数字人形象记录（GET /digitalHuman/avatars 列表元素、POST 上传 / PUT 改名返回体） */
export interface DigitalHumanAvatar {
  /** 记录主键（改名/删除以此引用） */
  id: string
  /** 数字人名称（用户命名） */
  name: string
  /** 上传视频的原始文件名 */
  sourceOriginalName: string
  /** 上传视频大小（字节） */
  sourceSize: number
  /** 上传视频 MIME 类型 */
  sourceMimeType: string
  /** 上传视频时长（秒），入库前已保证 >= MIN_AVATAR_VIDEO_DURATION_SEC */
  sourceDuration: number
  /** 参考视频的 file 记录 id */
  referenceFileId: string
  /** 参考视频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  referenceUrl: string
  /** 参考视频时长（秒） */
  referenceDuration: number
  /** 合成后端，如 heygem */
  backend: string
  /** 归属用户 id */
  userId: string
  /** 创建 / 更新时间（ISO 字符串） */
  createdAt: string
  updatedAt: string
}

/** 分页结果（axios 拦截器已解出 data；后端多余的 page/limit 字段由 PageResult 兼容忽略） */
export type DigitalHumanAvatarPageResult = PageResult<DigitalHumanAvatar>

/** 上传视频最短时长（秒），与后端校验保持一致 */
export const MIN_AVATAR_VIDEO_DURATION_SEC = 5

/** 数字人合成任务状态：pending / running 为进行中，success / failed / cancelled 为终态 */
export type DigitalHumanSynthesisStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

/** 数字人合成记录（GET /digitalHuman/tasks 列表元素） */
export interface DigitalHumanSynthesisRecord {
  /** 任务主键 */
  id: string
  status: DigitalHumanSynthesisStatus
  /** 数字人形象 id */
  avatarId: string
  /** 音色 id */
  voiceId: string
  /** 待合成文本 */
  text: string
  /** 速度档位：fast / balanced / quality */
  speedMode: string
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 音频合成子任务 id */
  audioTaskId: string
  /** 产出音频的 file 记录 id */
  audioFileId: string
  /** 音频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  audioUrl: string
  /** 音频时长（秒） */
  audioDuration: number
  /** 成品视频地址，仅 success 时非空 */
  resultUrl: string
  /** 产出视频的 file 记录 id，仅 success 时非空 */
  resultFileId: string
  /** 成品视频时长（秒） */
  videoDuration: number
  /** 是否把字幕烧录进成品视频 */
  burnSubtitles: boolean
  /** 字幕合成子任务 id，未烧录字幕时为空串 */
  subtitleTaskId: string
  /** 产出字幕的 file 记录 id，未烧录字幕时为空串 */
  srtFileId: string
  /** 字幕地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀），未烧录字幕时为空串 */
  srtUrl: string
  /** 字幕条数，未烧录字幕时为 0 */
  cueCount: number
  /** 未烧录字幕的原视频 file 记录 id，仅烧录字幕时非空 */
  rawVideoFileId: string
  /** 未烧录字幕的原视频地址（后端已给出 /api/files/:id/download），仅烧录字幕时非空 */
  rawVideoUrl: string
  /** 开始执行时间（未开始时为空串） */
  startedAt: string
  /** 结束时间（未结束时为空串） */
  finishedAt: string
  /** 归属用户 id */
  userId: string
  /** 创建 / 更新时间（ISO 字符串） */
  createdAt: string
  updatedAt: string
}

/** 分页结果（axios 拦截器已解出 data；后端多余的 page/limit 字段由 PageResult 兼容忽略） */
export type DigitalHumanSynthesisRecordPageResult = PageResult<DigitalHumanSynthesisRecord>

/**
 * 提交数字人视频合成任务的入参（POST /digitalHuman/tasks/with-subtitle）。
 * 音频由后端按 text + voiceId 重建，前端只传文案、形象、音色与字幕任务：
 * subtitleId 为字幕任务 id（SubtitleTask.id），后端据此取 SRT 烧录进成品视频。
 */
export interface CreateDigitalHumanTaskParams {
  /** 待合成文案 */
  text: string
  /** 数字人形象 id */
  avatarId: string
  /** 音色 id */
  voiceId: string
  /** 字幕任务 id（POST /subtitles/tasks 返回的 taskId） */
  subtitleId: string
}

/** 提交数字人合成任务的返回，只建任务并返回 taskId */
export interface DigitalHumanTaskAccepted {
  taskId: string
  status: DigitalHumanSynthesisStatus
}

/** 数字人合成任务在当前用户队列中的位置（GET /digitalHuman/tasks/:taskId/queue） */
export interface DigitalHumanTaskQueue {
  taskId: string
  status: DigitalHumanSynthesisStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断数字人合成任务是否已到终态（终态后停止轮询） */
export function isDigitalHumanSynthesisFinished(
  status: DigitalHumanSynthesisStatus | undefined,
): boolean {
  return status === 'success' || status === 'failed' || status === 'cancelled'
}
