import type { FrameExtractTask } from '@/types/frame-extract'
import type { SceneTranscribeTask } from '@/types/scene-transcribe'
import type { VlmBatchTask } from '@/types/vlm-batch'

/** 场景切分任务状态：pending / running 为进行中，success / failed 为终态 */
export type SceneSplitTaskStatus = 'pending' | 'running' | 'success' | 'failed'

/** 切分高级参数（均为可选，缺省时由后端取该算法的推荐值） */
export interface DetectOptions {
  /** 检测算法：content / adaptive / threshold */
  detector?: string
  /** 检测阈值，缺省用该算法的推荐值 */
  threshold?: number
  /** 最短场景时长（秒） */
  minSceneLenSec?: number
  /** 检测前降采样倍数（1=不降采样） */
  downscale?: number
  /** 隔帧采样数（0=逐帧） */
  frameSkip?: number
  /** 首尾黑帧检测时长（秒），>0 时裁掉首尾的黑场片段 */
  blackDetectSec?: number
}

/** 单个场景（时间均为毫秒） */
export interface SceneSplitScene {
  index: number
  startMs: number
  endMs: number
  durationMs: number
}

/** 首尾黑帧检测出的黑场区间（时间均为毫秒） */
export interface SceneSplitBlackRange {
  startMs: number
  endMs: number
}

/** 场景切分任务详情（GET /aiDetect/scene/tasks/:id） */
export interface SceneSplitTask {
  /** 任务主键 */
  id: string
  status: SceneSplitTaskStatus
  /** 来源类型：fileId 素材库文件 / upload 本地上传 */
  sourceType: string
  /** 源视频 file 记录 id */
  sourceFileId: string
  /** 源视频地址（后端已给出 /api/files/:id/download，展示时交给 resolveMediaUrl 补前缀） */
  sourceUrl: string
  /** 源视频原始文件名 */
  originalName: string
  /** 远端地址（源为远端链接时非空） */
  remoteUrl: string
  /** 实际使用的检测算法 */
  detector: string
  /** 实际使用的检测阈值 */
  threshold: number
  /** 实际使用的最短场景时长（秒） */
  minSceneLenSec: number
  /** 实际使用的降采样倍数 */
  downscale: number
  /** 实际使用的隔帧采样数 */
  frameSkip: number
  /** 实际使用的首尾黑帧检测时长（秒） */
  blackDetectSec: number
  /** 进度 0..1 */
  progress: number
  /** ASCII 阶段 key */
  stage: string
  /** 该阶段的中文描述（服务端已映射好，可直接展示） */
  stageLabel: string
  /** 人类可读描述 / 失败原因 */
  message: string
  /** 场景数 */
  sceneCount: number
  /** 视频时长（毫秒） */
  durationMs: number
  /** 视频帧率 */
  frameRate: number
  /** 后端 pySceneDetect 版本 */
  pySceneDetectVersion: string
  /** 场景列表，仅 success 时非空 */
  scenes: SceneSplitScene[]
  /** 首尾黑帧检测出的黑场区间，无黑场时为空数组 */
  blackRanges: SceneSplitBlackRange[]
  /** 开始执行时间（未开始时为空串） */
  startedAt: string
  /** 结束时间（未结束时为空串） */
  finishedAt: string
  /** 归属用户 id */
  userId: string
  /** 创建 / 更新时间（ISO 字符串） */
  createdAt: string
  updatedAt: string
  /** 该源的抽帧任务列表（一个切分任务可能多次抽帧），无记录时为空数组 */
  frameTasks: FrameExtractTask[]
  /** 该源的场景转写任务列表，无记录时为空数组 */
  asrTasks: SceneTranscribeTask[]
  /** 该源的批量图像识别任务列表，无记录时为空数组 */
  imageTasks: VlmBatchTask[]
}

/** 提交场景切分任务的返回（POST /aiDetect/scene/tasks），只建任务并返回 taskId */
export interface SceneSplitTaskAccepted {
  taskId: string
  status: SceneSplitTaskStatus
}

/** 场景切分任务在当前用户队列中的位置（GET /aiDetect/scene/tasks/:taskId/queue） */
export interface SceneSplitTaskQueue {
  taskId: string
  status: SceneSplitTaskStatus
  /** 队列排位，1 为队首；任务已出队执行（running）时为 null */
  position: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 当前队列总深度 */
  queueDepth: number
  /** 运行中任务数 */
  running: number
}

/** 合并场景入参（POST /aiDetect/scene/tasks/:id/merge） */
export interface MergeScenesParams {
  /** 场景序号分组：每组为一段连续的场景序号，如 [[1,2]] */
  groups: number[][]
}

/** 判断场景切分任务是否已到终态（终态后停止轮询） */
export function isSceneSplitTaskFinished(status: SceneSplitTaskStatus | undefined): boolean {
  return status === 'success' || status === 'failed'
}
