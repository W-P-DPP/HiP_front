/** 场景转写任务状态：pending / running 为进行中，success / failed 为终态 */
export type SceneTranscribeTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 单条转写文本分段（时间均为毫秒） */
export interface SceneTranscribeSegment {
  /** 分段开始时间（毫秒） */
  startMs: number
  /** 分段结束时间（毫秒） */
  endMs: number
  /** 识别文本 */
  text: string
}

/** 单个场景对应的转写结果（index 与场景切分 scenes.index 对应） */
export interface SceneTranscribeSceneSegments {
  /** 场景序号 */
  index: number
  /** 场景开始时间（毫秒） */
  startMs: number
  /** 场景结束时间（毫秒） */
  endMs: number
  /** 该场景内的文本分段 */
  segments: SceneTranscribeSegment[]
}

/** 音频分片（长音频切成多段识别，记录每片的 wav 产物） */
export interface SceneTranscribeChunk {
  /** 分片序号 */
  index: number
  /** 分片开始时间（毫秒） */
  startMs: number
  /** 分片结束时间（毫秒） */
  endMs: number
  /** 分片 wav 的 file 记录 id */
  wavFileId: string
  /** 分片 wav 地址（/api/files/:id/download） */
  wavUrl: string
  /** 该分片对应的字幕子任务 id */
  subtitleTaskId: string
  /** 该分片识别出的字幕条数 */
  cueCount: number
}

/** 场景转写任务详情（GET /aiDetect/asr/tasks/:id） */
export interface SceneTranscribeTask {
  /** 任务主键 */
  id: string
  status: SceneTranscribeTaskStatus
  /** 来源场景切分任务 id */
  sourceTaskId: string
  /** 源视频 file 记录 id */
  sourceFileId: string
  /** 源视频地址（/api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  sourceUrl: string
  /** 源视频原始文件名 */
  originalName: string
  /** 场景数 */
  sceneCount: number
  /** 视频时长（毫秒） */
  durationMs: number
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 识别后端，如 whisper */
  provider: string
  /** 文本分段总数 */
  segmentCount: number
  /** 全量文本分段，仅 success 时非空 */
  segments: SceneTranscribeSegment[]
  /** 按场景归组的文本分段，仅 success 时非空 */
  sceneSegments: SceneTranscribeSceneSegments[]
  /** 音频分片列表，仅 success 时非空 */
  chunks: SceneTranscribeChunk[]
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

/** 提交场景转写任务的返回（POST /aiDetect/asr/tasks），只建任务并返回 taskId */
export interface SceneTranscribeTaskAccepted {
  taskId: string
  status: SceneTranscribeTaskStatus
}

/** 场景转写任务在当前用户队列中的位置（GET /aiDetect/asr/tasks/:taskId/queue） */
export interface SceneTranscribeTaskQueue {
  taskId: string
  status: SceneTranscribeTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断场景转写任务是否已到终态（终态后停止轮询） */
export function isSceneTranscribeTaskFinished(
  status: SceneTranscribeTaskStatus | undefined,
): boolean {
  return status === 'success' || status === 'failed'
}
