import type { NumericFieldKey } from '@/constant/scene-process'
import type { FrameExtractStatus } from '@/hooks/use-frame-extraction'
import type { NarrationVideoController } from '@/hooks/use-narration-video'
import type { SceneSplitStatus } from '@/hooks/use-scene-split'
import type { SceneTranscriptionStatus } from '@/hooks/use-scene-transcription'
import type { VideoCommentaryController } from '@/hooks/use-video-commentary'
import type { VideoUnderstandingController } from '@/hooks/use-video-understanding'
import type { VlmBatchStatus } from '@/hooks/use-vlm-batch'
import type { FrameExtractTask, FrameSceneGroup } from '@/types/frame-extract'
import type { SceneSplitScene, SceneSplitTask } from '@/types/scene-split'
import type {
  SceneTranscribeSceneSegments,
  SceneTranscribeTask,
} from '@/types/scene-transcribe'
import type { VideoMaterial } from '@/types/video-material'
import type { VlmBatchItem, VlmBatchTask } from '@/types/vlm-batch'

/**
 * 场景处理流程各步骤所需的控制器切片。
 * 字段名与 useSceneProcess 的控制器一致，工厂控制器可直接传入。
 */

/** 步骤 · 场景切分（表单 + 任务状态 + 场景表数据） */
export interface SceneSplitStageController {
  /** 选中的视频素材（来源只有素材库一种） */
  material: VideoMaterial | null
  setMaterial: (value: VideoMaterial | null) => void
  /** 检测算法，default 表示走后端推荐值 */
  detector: string
  setDetector: (value: string) => void
  /** 可选数字参数表单值（字符串，留空走后端默认） */
  numericValues: Record<NumericFieldKey, string>
  setNumericValue: (key: NumericFieldKey, raw: string) => void
  /** 非法（非数字 / 负数）的字段名 */
  invalidFieldKeys: NumericFieldKey[]
  hasInvalidParams: boolean
  /** 切分状态：idle 未提交，其余与后端任务状态一致 */
  splitStatus: SceneSplitStatus
  /** 是否正在切分（提交中 / 排队中 / 切分中） */
  isSplitting: boolean
  splitQueuePosition: number | null
  splitWaitingAhead: number
  splitQueueDepth: number
  splitProgress: number
  splitStageLabel: string
  splitError: string
  /** 切分任务详情（成功后含 scenes） */
  sceneSplitTask: SceneSplitTask | null
  /** 场景列表，仅成功时非空 */
  scenes: SceneSplitScene[]
  /** 提交场景切分任务 */
  split: () => void
  /** 重新拉取任务详情（合并场景后就地刷新 scenes） */
  refreshTask: () => void
  /** 场景切分是否成功完成（门闩：进入抽帧/转写的前置条件） */
  isSceneSplitDone: boolean
  goNext: () => void
}

/** 步骤 · 抽帧 */
export interface FrameExtractStageController {
  /** 复用场景切分的场景列表作为表格数据 */
  scenes: SceneSplitScene[]
  /** 场景切分尚未就绪（用于表格骨架屏） */
  scenesLoading: boolean
  isSceneSplitDone: boolean
  /** 抽帧状态：idle 未提交，其余与后端任务状态一致 */
  frameStatus: FrameExtractStatus
  isExtractingFrames: boolean
  frameQueuePosition: number | null
  frameWaitingAhead: number
  frameQueueDepth: number
  frameProgress: number
  frameStageLabel: string
  frameError: string
  /** 抽帧任务详情（成功后含 frames） */
  frameTask: FrameExtractTask | null
  /** 按场景序号索引的抽帧结果 */
  framesByScene: ReadonlyMap<number, FrameSceneGroup>
  /** 抽出的总帧数 */
  frameCount: number
  /** 是否可提交抽帧（来源场景任务已就绪） */
  canExtractFrames: boolean
  extractFrames: () => void
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 场景转写 */
export interface SceneTranscribeStageController {
  /** 复用场景切分的场景列表作为表格数据 */
  scenes: SceneSplitScene[]
  /** 场景切分尚未就绪（用于表格骨架屏） */
  scenesLoading: boolean
  /** 场景切分是否成功完成（转写的前置条件） */
  isSceneSplitDone: boolean
  /** 转写状态：idle 未提交，其余与后端任务状态一致 */
  transcribeStatus: SceneTranscriptionStatus
  isTranscribing: boolean
  transcribeQueuePosition: number | null
  transcribeWaitingAhead: number
  transcribeQueueDepth: number
  transcribeProgress: number
  transcribeStageLabel: string
  transcribeError: string
  /** 转写任务详情（成功后含 sceneSegments） */
  transcribeTask: SceneTranscribeTask | null
  /** 按场景归组的文本分段 */
  transcribeSceneSegments: SceneTranscribeSceneSegments[]
  /** 文本分段总数 */
  transcribeSegmentCount: number
  /** 是否可提交转写（来源场景任务已就绪） */
  canTranscribe: boolean
  transcribe: () => void
  /** 抽帧是否成功完成（下一步「场景图像识别」的前置条件） */
  isFrameExtractDone: boolean
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 场景图像识别（批量 VLM） */
export interface SceneRecognizeStageController {
  /** 复用场景切分的场景列表作为表格数据 */
  scenes: SceneSplitScene[]
  /** 场景切分尚未就绪（用于表格骨架屏） */
  scenesLoading: boolean
  /** 抽帧是否成功完成（识别的前置条件） */
  isFrameExtractDone: boolean
  /** 识别状态：idle 未提交，其余与后端任务状态一致 */
  batchStatus: VlmBatchStatus
  isRecognizing: boolean
  batchQueuePosition: number | null
  batchWaitingAhead: number
  batchQueueDepth: number
  batchProgress: number
  batchStageLabel: string
  batchError: string
  /** 识别任务详情（成功后含 items） */
  batchTask: VlmBatchTask | null
  /** 按场景序号归组的逐项结果 */
  batchItemsByScene: ReadonlyMap<number, VlmBatchItem[]>
  /** 总项数 / 成功项数 / 失败项数 */
  batchTotal: number
  batchSucceeded: number
  batchFailed: number
  /** 整批共用的输出模式 */
  batchMode: string
  setBatchMode: (value: string) => void
  /** 整批共用的提示词 */
  batchPrompt: string
  setBatchPrompt: (value: string) => void
  /** 是否可提交识别（来源抽帧任务已就绪） */
  canRecognize: boolean
  recognize: () => void
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 视频理解（拼接识别结果 + 转写文本，调 LLM 生成结构化中间层） */
export interface SceneUnderstandStageController extends VideoUnderstandingController {
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 解说生成（根据视频理解结果调 LLM 生成结构化解说） */
export interface SceneCommentaryStageController extends VideoCommentaryController {
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 视频解说（选音色与语速档位，合成解说视频） */
export interface SceneNarrationVideoStageController extends NarrationVideoController {
  goPrev: () => void
}
