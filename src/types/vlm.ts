/** 图像理解任务状态：pending / running 为进行中，success / failed 为终态 */
export type VlmTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 输出模式：json 结构化结果 / text 纯文本 */
export type VlmTaskMode = 'json' | 'text'

/** 结构化理解结果（mode=json 且任务成功时非空） */
export interface VlmResult {
  /** 一句话概括画面内容 */
  description: string
  /** 画面中主要物体或人物名称 */
  objects: string[]
  /** 正在发生的动作 */
  actions: string[]
  /** 场景类型：indoor / outdoor / other */
  sceneType: string
  /** 便于检索的主题标签 */
  tags: string[]
}

/** 图像理解任务（GET /vlm/tasks/:id 详情） */
export interface VlmTask {
  /** 任务主键 */
  id: string
  status: VlmTaskStatus
  /** 来源类型：upload 本地上传 / fileId 素材库文件 */
  sourceType: string
  /** 源图片 file 记录 id */
  sourceFileId: string
  /** 源图片地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  sourceUrl: string
  /** 源图片原始文件名 */
  originalName: string
  /** 实际使用的提示词（未自定义时为后端默认） */
  prompt: string
  /** 输出模式 */
  mode: string
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 结构化结果，mode=text 或未成功时为 null */
  result: VlmResult | null
  /** 模型原始输出文本 */
  rawText: string
  /** 模型调用次数 */
  modelCalls: number
  /** 模型标识 */
  modelId: string
  /** 耗时（毫秒） */
  elapsedMs: number
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

/** 提交图像理解任务的返回（POST /vlm/tasks），只建任务并返回 taskId */
export interface VlmTaskAccepted {
  taskId: string
  status: VlmTaskStatus
}

/** 图像理解任务在当前用户队列中的位置（GET /vlm/tasks/:taskId/queue） */
export interface VlmTaskQueue {
  taskId: string
  status: VlmTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断图像理解任务是否已到终态（终态后停止轮询） */
export function isVlmTaskFinished(status: VlmTaskStatus | undefined): boolean {
  return status === 'success' || status === 'failed'
}
