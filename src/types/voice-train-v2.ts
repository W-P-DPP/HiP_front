/**
 * 音色库记录（GET /voiceTrainV2/voices 列表元素、POST 上传 / PUT 改名返回体）。
 *
 * 零样本克隆：创建音色不做训练，只把上传素材归一化成 mono 22050Hz 的 reference.wav 存盘，
 * 合成时才作为 spk_audio_prompt 使用。原始素材不入库，故只有 source* 元数据留档。
 */
export interface VoiceTrainV2Voice {
  /** 音色记录主键（提交合成时以它引用音色） */
  id: string
  /** 音色名称（用户命名，同一用户内唯一） */
  resourceName: string
  /** 上传素材的原始文件名 */
  sourceOriginalName: string
  /** 上传素材大小（字节） */
  sourceSize: number
  /** 上传素材 MIME 类型 */
  sourceMimeType: string
  /** 上传素材时长（秒），入库前已保证 >= MIN_TRAIN_AUDIO_DURATION_SEC */
  sourceDuration: number
  /** 归一化 reference.wav 的 file 记录 id */
  referenceFileId: string
  /** 参考音试听地址（后端已给出 /api/files/:id/download，交给 resolveMediaUrl 补前缀） */
  referenceUrl: string
  /** 归一化 reference.wav 时长（秒） */
  referenceDuration: number
  /** 参考音对应文本（仅作元数据，零样本合成不使用） */
  promptText: string
  /** 合成后端，当前固定 indextts */
  backend: string
  /** 参考音采样率，固定 22050 */
  sampleRate: number
  /** 最近一次成功合成的试听产物 file 记录 id，未生成时为空串 */
  previewFileId: string
  /** 克隆试听地址（后端已给出 /api/files/:id/download，交给 resolveMediaUrl 补前缀），未生成时为空串 */
  previewUrl: string
  /** 生成该试听所用的文本，未生成时为空串 */
  previewText: string
  /** 试听音频时长（秒），未生成时为 0 */
  previewDuration: number
  /** 归属用户 id */
  userId: string
  /** 创建 / 更新时间（ISO 字符串） */
  createdAt: string
  updatedAt: string
}

/** 合成任务状态：pending / running 为进行中，success / failed 为终态 */
export type VoiceTrainV2SynthesisStatus = 'pending' | 'running' | 'success' | 'failed'

/** 合成速度档位：fast 极速 / balanced 均衡 / quality 高质量 */
export type VoiceTrainV2SpeedMode = 'fast' | 'balanced' | 'quality'

/**
 * 合成任务（GET /voiceTrainV2/synthesize/:taskId）。
 * 合成是异步任务：提交只建 pending 任务，需轮询本结构直到 status 进入终态。
 */
export interface VoiceTrainV2SynthesisTask {
  id: string
  status: VoiceTrainV2SynthesisStatus
  /** 音色库记录 id */
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
  /** 产出音频时长（秒） */
  duration: number
  /** 试听地址，仅 success 时非空 */
  resultUrl: string
  /** 产出音频的 file 记录 id，仅 success 时非空 */
  resultFileId: string
  userId: string
  createdAt: string
  updatedAt: string
}

/**
 * 音色合成记录（GET /voiceTrainV2/synthesize 列表元素）。
 * 与任务详情同构，额外带用途与起止时间。
 */
export interface VoiceTrainV2SynthesisRecord extends VoiceTrainV2SynthesisTask {
  /** 合成用途：preview 试听 / synthesis 正式合成 */
  purpose: string
  /** 开始执行时间（未开始时为空串） */
  startedAt: string
  /** 结束时间（未结束时为空串） */
  finishedAt: string
}

/** 提交合成任务的返回（POST /voiceTrainV2/synthesize） */
export interface VoiceTrainV2SynthesizeAccepted {
  taskId: string
  status: VoiceTrainV2SynthesisStatus
}

/** 合成任务在当前用户队列中的位置（GET /voiceTrainV2/synthesize/:taskId/queue） */
export interface VoiceTrainV2SynthesisQueue {
  taskId: string
  status: VoiceTrainV2SynthesisStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断合成任务是否已到终态（终态后停止轮询） */
export function isVoiceTrainV2SynthesisFinished(
  status: VoiceTrainV2SynthesisStatus | undefined,
): boolean {
  return status === 'success' || status === 'failed'
}

/** 训练音频最短时长（秒），与后端 MIN_TRAIN_AUDIO_DURATION_SEC 保持一致 */
export const MIN_TRAIN_AUDIO_DURATION_SEC = 10

/** 普通 user 角色允许拥有的音色上限，达到后隐藏「创建音色」按钮 */
export const USER_VOICE_LIMIT = 3
