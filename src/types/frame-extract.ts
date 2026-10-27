/** 抽帧任务状态：pending / running 为进行中，success / failed 为终态 */
export type FrameExtractTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 单个关键帧采样点 */
export interface FrameSample {
  /** 采样类型：start 起始 / mid 中间 / end 结束 */
  kind: string
  /** 采样时间点（毫秒） */
  timeMs: number
  /** 图片 file 记录 id */
  fileId: string
  /** 图片地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  url: string
}

/** 单个场景的抽帧结果（index 与场景切分 scenes.index 对应） */
export interface FrameSceneGroup {
  /** 场景序号 */
  index: number
  /** 场景开始时间（毫秒） */
  startMs: number
  /** 场景结束时间（毫秒） */
  endMs: number
  /** 该场景抽出的关键帧（start / mid / end） */
  frames: FrameSample[]
}

/** 抽帧任务详情（GET /aiDetect/frames/tasks/:id） */
export interface FrameExtractTask {
  /** 任务主键 */
  id: string
  status: FrameExtractTaskStatus
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
  /** 视频帧率 */
  frameRate: number
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 抽出的总帧数 */
  frameCount: number
  /** 各场景的抽帧结果，仅 success 时非空 */
  frames: FrameSceneGroup[]
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

/** 提交抽帧任务的返回（POST /aiDetect/frames/tasks），只建任务并返回 taskId */
export interface FrameExtractTaskAccepted {
  taskId: string
  status: FrameExtractTaskStatus
}

/** 抽帧任务在当前用户队列中的位置（GET /aiDetect/frames/tasks/:taskId/queue） */
export interface FrameExtractTaskQueue {
  taskId: string
  status: FrameExtractTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断抽帧任务是否已到终态（终态后停止轮询） */
export function isFrameExtractTaskFinished(status: FrameExtractTaskStatus | undefined): boolean {
  return status === 'success' || status === 'failed'
}
