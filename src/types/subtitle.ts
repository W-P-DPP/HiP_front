/** 字幕任务状态：pending / running 为进行中，success / failed 为终态 */
export type SubtitleTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 字幕合成记录（GET /subtitles/tasks 列表元素、GET /subtitles/tasks/:id 详情） */
export interface SubtitleTask {
  /** 任务主键 */
  id: string
  status: SubtitleTaskStatus
  /** 来源类型：fileId 素材库文件 / upload 本地上传 */
  sourceType: string
  /** 音频 file 记录 id */
  audioFileId: string
  /** 音频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  audioUrl: string
  /** 音频原始文件名 */
  originalName: string
  /** 识别语言，如 autodialect */
  language: string
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 识别后端，如 xunfei */
  provider: string
  /** SRT file 记录 id */
  srtFileId: string
  /** SRT 地址（/api/files/:id/download），仅 success 时非空 */
  srtUrl: string
  /** 字幕条数 */
  cueCount: number
  /** 音频时长（秒） */
  audioDuration: number
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

/** 提交字幕任务的返回（POST /subtitles/tasks），只建任务并返回 taskId */
export interface SubtitleTaskAccepted {
  taskId: string
  status: SubtitleTaskStatus
}

/** 字幕任务在当前用户队列中的位置（GET /subtitles/tasks/:taskId/queue） */
export interface SubtitleTaskQueue {
  taskId: string
  status: SubtitleTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断字幕任务是否已到终态（终态后停止轮询） */
export function isSubtitleTaskFinished(status: SubtitleTaskStatus | undefined): boolean {
  return status === 'success' || status === 'failed'
}
