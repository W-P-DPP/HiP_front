import type { VlmResult } from '@/types/vlm'

/** 批量图像识别任务状态：pending / running 为进行中，success / failed 为终态 */
export type VlmBatchTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 单张关键帧的识别结果 */
export interface VlmBatchItem {
  /** 结果项序号（从 0 开始） */
  index: number
  /** 所属场景序号（与场景切分 scenes.index 对应） */
  sceneIndex: number
  /** 关键帧类型：start 起始 / mid 中间 / end 结束 */
  frameKind: string
  /** 采样时间点（毫秒） */
  timeMs: number
  /** 图片 file 记录 id */
  fileId: string
  /** 图片地址（/api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  url: string
  /** 该项状态：success / failed */
  status: string
  /** 结构化结果，mode=text 或该项失败时为 null */
  result: VlmResult | null
  /** 模型原始输出文本 */
  rawText: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 模型调用次数 */
  modelCalls: number
  /** 模型标识 */
  modelId: string
  /** 该项耗时（毫秒） */
  elapsedMs: number
}

/** 批量图像识别任务详情（GET /vlmBatch/tasks/:id） */
export interface VlmBatchTask {
  /** 任务主键 */
  id: string
  status: VlmBatchTaskStatus
  /** 来源类型，如 framesTask（抽帧任务） */
  sourceType: string
  /** 来源抽帧任务 id */
  sourceTaskId: string
  /** 源视频 file 记录 id */
  sourceFileId: string
  /** 源视频地址（/api/files/:id/download） */
  sourceUrl: string
  /** 源视频原始文件名 */
  originalName: string
  /** 整批共用的提示词（未自定义时为后端默认） */
  prompt: string
  /** 整批共用的输出模式 */
  mode: string
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 总项数 */
  total: number
  /** 成功项数 */
  succeeded: number
  /** 失败项数 */
  failed: number
  /** 逐项结果，仅 success 时非空 */
  items: VlmBatchItem[]
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

/** 提交批量图像识别任务的返回（POST /vlmBatch/tasks） */
export interface VlmBatchTaskAccepted {
  taskId: string
  status: VlmBatchTaskStatus
}

/** 批量图像识别任务在当前用户队列中的位置（GET /vlmBatch/tasks/:taskId/queue） */
export interface VlmBatchTaskQueue {
  taskId: string
  status: VlmBatchTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断批量图像识别任务是否已到终态（终态后停止轮询） */
export function isVlmBatchTaskFinished(status: VlmBatchTaskStatus | undefined): boolean {
  return status === 'success' || status === 'failed'
}
