import type { VideoCommentary } from '@/types/video-commentary'
import type { VoiceTrainV2SpeedMode } from '@/types/voice-train-v2'

/** 视频解说任务状态：pending / running 为进行中，success / failed 为终态 */
export type NarrationVideoTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 解说视频分镜配画面的原片片段（时间均为毫秒） */
export interface NarrationVideoClip {
  /** 原片片段开始时间（毫秒） */
  startMs: number
  /** 原片片段结束时间（毫秒） */
  endMs: number
  /** 该片段的关键内容说明 */
  description: string
}

/** 解说视频分镜（响应侧，时间均为毫秒） */
export interface NarrationVideoSegment {
  /** 分镜序号（从 1 开始） */
  index: number
  /** 分镜开始时间（毫秒） */
  startMs: number
  /** 分镜结束时间（毫秒） */
  endMs: number
  /** 该分镜的解说词 */
  text: string
  /** 语气 / 情绪 */
  emotion: string
  /** 用于配画面的原片关键片段 */
  clips: NarrationVideoClip[]
}

/** 单个分镜的配音产物（响应侧） */
export interface NarrationVideoSegmentState {
  /** 对应的分镜序号 */
  index: number
  /** 该分镜的配音子任务 id */
  voiceTaskId: string
  /** 配音音频的 file 记录 id */
  audioFileId: string
  /** 配音音频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  audioUrl: string
  /** 配音音频时长（毫秒） */
  audioDurationMs: number
}

/**
 * 视频解说任务详情（GET /narrationVideo/tasks/:taskId）。
 * 提交只建 pending 任务，需轮询本结构直到 status 进入终态；成功后含成品视频与字幕产物。
 */
export interface NarrationVideoTask {
  /** 任务主键 */
  id: string
  status: NarrationVideoTaskStatus
  /** 来源场景切分任务 id */
  sceneTaskId: string
  /** 源视频 file 记录 id */
  sourceFileId: string
  /** 源视频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  sourceUrl: string
  /** 源视频原始文件名 */
  sourceOriginalName: string
  /** 源视频时长（毫秒） */
  sourceDurationMs: number
  /** 解说标题 */
  title: string
  /** 整段解说总述 */
  summary: string
  /** 分镜解说列表 */
  segments: NarrationVideoSegment[]
  /** 使用的音色 id */
  voiceId: string
  /** 语速档位：fast / balanced / quality */
  speedMode: string
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 各分镜配音产物列表 */
  segmentStates: NarrationVideoSegmentState[]
  /** 字幕 SRT 文件的 file 记录 id，仅 success 时非空 */
  srtFileId: string
  /** 字幕 SRT 地址，仅 success 时非空 */
  srtUrl: string
  /** 字幕条数 */
  cueCount: number
  /** 成品视频的 file 记录 id，仅 success 时非空 */
  videoFileId: string
  /** 成品视频地址，仅 success 时非空 */
  videoUrl: string
  /** 成品视频时长（秒） */
  videoDuration: number
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

/** 提交视频解说任务的入参（POST /narrationVideo/tasks） */
export interface CreateNarrationVideoTaskParams {
  /** 来源场景切分任务 id */
  sceneTaskId: string
  /** 音色库记录 id */
  voiceId: string
  /** 语速档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 结构化解说（解说生成步骤的结构化数据） */
  narration: VideoCommentary
}

/** 提交视频解说任务的返回（POST /narrationVideo/tasks），只建任务并返回 taskId */
export interface NarrationVideoTaskAccepted {
  taskId: string
  status: NarrationVideoTaskStatus
}

/** 视频解说任务在当前用户队列中的位置（GET /narrationVideo/tasks/:taskId/queue） */
export interface NarrationVideoTaskQueue {
  taskId: string
  status: NarrationVideoTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断视频解说任务是否已到终态（终态后停止轮询） */
export function isNarrationVideoTaskFinished(
  status: NarrationVideoTaskStatus | undefined,
): boolean {
  return status === 'success' || status === 'failed'
}
