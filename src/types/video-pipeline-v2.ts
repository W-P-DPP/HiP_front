/** 短视频合成任务状态：pending / running 为进行中，success / failed / cancelled 为终态 */
export type VideoPipelineV2TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

/**
 * 短视频合成任务。
 * 列表（GET /videoPipelineV2/tasks）元素与详情（GET /videoPipelineV2/tasks/:id）同构。
 * 流水线串行产出：先配音（voiceTaskId），再字幕（subtitleTaskId），最后烧录成品视频（videoUrl）。
 */
export interface VideoPipelineV2Task {
  /** 任务主键（列表行 key，详情按它查询） */
  id: string
  /** 任务状态 */
  status: VideoPipelineV2TaskStatus
  /** 待合成文本（入参快照，可能很长） */
  text: string
  /** 音色库记录 id */
  voiceId: string
  /** 速度档位：fast / balanced / quality */
  speedMode: string
  /** 每段字幕对应的素材搜索词 */
  keywords: string[]
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 配音子任务 id */
  voiceTaskId: string
  /** 合成音频的 file 记录 id */
  audioFileId: string
  /** 合成音频地址（后端给 /api/files/:id/download，交给 resolveMediaUrl 补前缀），未就绪为空串 */
  audioUrl: string
  /** 合成音频时长（秒），未就绪为 0 */
  audioDuration: number
  /** 字幕子任务 id */
  subtitleTaskId: string
  /** SRT 字幕文件的 file 记录 id */
  srtFileId: string
  /** SRT 字幕地址（后端给 /api/files/:id/download，交给 resolveMediaUrl 补前缀），未就绪为空串 */
  srtUrl: string
  /** 字幕条数 */
  cueCount: number
  /** 配音合成提供方（如 indextts），未就绪为空串 */
  provider: string
  /** 成品视频的 file 记录 id */
  videoFileId: string
  /** 成品视频地址（后端给 /api/files/:id/download，交给 resolveMediaUrl 补前缀），未就绪为空串 */
  videoUrl: string
  /** 成品视频时长（秒），未就绪为 0 */
  videoDuration: number
  /** 开始执行时间（未开始时为空串） */
  startedAt: string
  /** 归属用户 id */
  userId: string
  /** 创建 / 更新时间（ISO 字符串） */
  createdAt: string
  updatedAt: string
}

/** 提交视频合成任务的返回（POST /videoPipelineV2/tasks/compose），只建任务并返回 taskId */
export interface VideoPipelineV2TaskAccepted {
  taskId: string
  status: VideoPipelineV2TaskStatus
}

/** 视频合成任务在当前用户队列中的位置（GET /videoPipelineV2/tasks/:taskId/queue） */
export interface VideoPipelineV2TaskQueue {
  taskId: string
  status: VideoPipelineV2TaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 判断视频合成任务是否已到终态（终态后停止轮询） */
export function isVideoPipelineV2TaskFinished(
  status: VideoPipelineV2TaskStatus | undefined,
): boolean {
  return status === 'success' || status === 'failed' || status === 'cancelled'
}
