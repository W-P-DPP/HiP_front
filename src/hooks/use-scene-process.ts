import { useCallback, useMemo, useState } from 'react'

import { createSceneSplitTask } from '@/api/scene-split'
import {
  COMMENTARY_STEP,
  EMPTY_NUMERIC_VALUES,
  NARRATION_VIDEO_STEP,
  SCENE_PROCESS_STEPS,
  UNDERSTAND_STEP,
} from '@/constant/scene-process'
import type { NumericFieldKey } from '@/constant/scene-process'
import { useFrameExtraction } from '@/hooks/use-frame-extraction'
import type { FrameExtractStatus } from '@/hooks/use-frame-extraction'
import { useNarrationVideo } from '@/hooks/use-narration-video'
import type { NarrationVideoController } from '@/hooks/use-narration-video'
import { useSceneSplit } from '@/hooks/use-scene-split'
import type { SceneSplitStatus } from '@/hooks/use-scene-split'
import { useSceneTranscription } from '@/hooks/use-scene-transcription'
import type { SceneTranscriptionStatus } from '@/hooks/use-scene-transcription'
import { useVideoCommentary } from '@/hooks/use-video-commentary'
import type { VideoCommentaryController } from '@/hooks/use-video-commentary'
import { useVideoUnderstanding } from '@/hooks/use-video-understanding'
import type { VideoUnderstandingController } from '@/hooks/use-video-understanding'
import { useVlmBatch } from '@/hooks/use-vlm-batch'
import type { VlmBatchStatus } from '@/hooks/use-vlm-batch'
import type { FrameExtractTask, FrameSceneGroup } from '@/types/frame-extract'
import type { SceneSplitScene, SceneSplitTask } from '@/types/scene-split'
import type {
  SceneTranscribeSceneSegments,
  SceneTranscribeTask,
} from '@/types/scene-transcribe'
import type { VideoMaterial } from '@/types/video-material'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import type { VlmBatchItem, VlmBatchTask } from '@/types/vlm-batch'
import type { SceneProcessSeed } from '@/types/workbench'
import { buildDetectOptions, resolveInvalidFieldKeys } from '@/utils/scene-split'
import { buildSceneProcessMaterial } from '@/utils/workbench'

const LAST_STEP = SCENE_PROCESS_STEPS.length - 1

/** 批量图像识别 step 下标（第 4 步） */
const RECOGNIZE_STEP = 3

/** 视频理解结果为空时的稳定空数组（避免每次渲染新建导致下游依赖抖动） */
const EMPTY_UNDERSTANDING_SEGMENTS: readonly VideoUnderstandingSegment[] = []

/** 场景处理流程的状态与动作（六步均接真实接口；后两步复用 /aiChat 流式对话） */
export interface SceneProcessController {
  /** 当前步骤下标 */
  step: number
  /** 选中的视频素材（场景切分步骤的表单输入） */
  material: VideoMaterial | null
  setMaterial: (value: VideoMaterial | null) => void
  /** 检测算法 */
  detector: string
  setDetector: (value: string) => void
  /** 可选数字参数表单值 */
  numericValues: Record<NumericFieldKey, string>
  setNumericValue: (key: NumericFieldKey, raw: string) => void
  /** 非法（非数字 / 负数）的字段名与是否存在非法项 */
  invalidFieldKeys: NumericFieldKey[]
  hasInvalidParams: boolean
  /** 场景切分状态与动作 */
  splitStatus: SceneSplitStatus
  isSplitting: boolean
  splitQueuePosition: number | null
  splitWaitingAhead: number
  splitQueueDepth: number
  splitProgress: number
  splitStageLabel: string
  splitError: string
  sceneSplitTask: SceneSplitTask | null
  scenes: SceneSplitScene[]
  /** 场景切分尚未成功（用于场景表骨架屏） */
  scenesLoading: boolean
  split: () => void
  refreshTask: () => void
  /** 抽帧状态与动作 */
  frameStatus: FrameExtractStatus
  isExtractingFrames: boolean
  frameQueuePosition: number | null
  frameWaitingAhead: number
  frameQueueDepth: number
  frameProgress: number
  frameStageLabel: string
  frameError: string
  frameTask: FrameExtractTask | null
  framesByScene: ReadonlyMap<number, FrameSceneGroup>
  frameCount: number
  canExtractFrames: boolean
  extractFrames: () => void
  /** 场景转写状态与动作 */
  transcribeStatus: SceneTranscriptionStatus
  isTranscribing: boolean
  transcribeQueuePosition: number | null
  transcribeWaitingAhead: number
  transcribeQueueDepth: number
  transcribeProgress: number
  transcribeStageLabel: string
  transcribeError: string
  transcribeTask: SceneTranscribeTask | null
  transcribeSceneSegments: SceneTranscribeSceneSegments[]
  transcribeSegmentCount: number
  canTranscribe: boolean
  transcribe: () => void
  /** 批量图像识别状态与动作 */
  batchStatus: VlmBatchStatus
  isRecognizing: boolean
  batchQueuePosition: number | null
  batchWaitingAhead: number
  batchQueueDepth: number
  batchProgress: number
  batchStageLabel: string
  batchError: string
  batchTask: VlmBatchTask | null
  batchItemsByScene: ReadonlyMap<number, VlmBatchItem[]>
  batchTotal: number
  batchSucceeded: number
  batchFailed: number
  /** 整批共用的输出模式 */
  batchMode: string
  setBatchMode: (value: string) => void
  /** 整批共用的提示词 */
  batchPrompt: string
  setBatchPrompt: (value: string) => void
  canRecognize: boolean
  recognize: () => void
  /** 视频理解（第 5 步）控制器 */
  understanding: VideoUnderstandingController
  /** 解说生成（第 6 步）控制器 */
  commentary: VideoCommentaryController
  /** 解说生成是否成功（视频解说的前置门闩） */
  isCommentaryDone: boolean
  /** 视频解说（第 7 步）控制器 */
  narrationVideo: NarrationVideoController
  /** 场景切分是否成功完成（抽帧与转写的前置门闩） */
  isSceneSplitDone: boolean
  /** 抽帧是否成功完成（场景图像识别的前置门闩） */
  isFrameExtractDone: boolean
  /** 该步骤是否已解锁（可点击跳转） */
  canEnterStep: (index: number) => boolean
  goPrev: () => void
  goNext: () => void
  goToStep: (index: number) => void
}

/**
 * 场景处理流程状态机：七步向导（场景切分 → 抽帧 → 场景转写 → 场景图像识别 → 视频理解 → 解说生成 → 视频解说）。
 *
 * 门闩按依赖而非线性链：
 * - 抽帧（1）与场景转写（2）只要求场景切分成功（转写不依赖抽帧，故两者同源）；
 * - 场景图像识别（3）要求抽帧成功（其来源是抽帧产物）；
 * - 视频理解（4）要求图像识别成功（识别结果为主，转写文本有则一并使用）；
 * - 解说生成（5）要求视频理解成功（其输入是视频理解结果）；
 * - 视频解说（6）要求解说生成成功（其输入是结构化解说）。
 *
 * 携带记录跳转（seed）时预填源素材与切分参数，并预载其切分任务，进入即处于「切分已完成」状态。
 */
export function useSceneProcess(seed?: SceneProcessSeed): SceneProcessController {
  const [step, setStep] = useState(0)
  // 场景切分表单：来源只有素材库一种，故不设上传态；携带记录时用其源视频构造占位素材
  const [material, setMaterial] = useState<VideoMaterial | null>(() =>
    seed ? buildSceneProcessMaterial(seed) : null,
  )
  const [detector, setDetector] = useState(seed?.detector ?? 'default')
  const [numericValues, setNumericValues] = useState<Record<NumericFieldKey, string>>(
    seed?.numericValues ?? EMPTY_NUMERIC_VALUES,
  )
  // 批量图像识别的整批共用参数
  const [batchMode, setBatchMode] = useState('json')
  const [batchPrompt, setBatchPrompt] = useState('')

  // 源标识：素材取 fileId；变化即视为上一轮结果失效
  const sourceKey = material ? `material:${material.fileId}` : ''

  // 提交函数：剔除未填写的可选参数后再发请求
  const submit = useMemo(() => {
    if (!material) return undefined
    return () =>
      createSceneSplitTask({
        fileId: material.fileId,
        ...buildDetectOptions(numericValues, detector),
      })
  }, [material, numericValues, detector])

  // 携带记录跳转时把其切分任务作为初始观察对象（sourceKey 与源素材派生一致）
  const sceneSplit = useSceneSplit({
    sourceKey,
    submit,
    seed: seed
      ? { taskId: seed.taskId, sourceKey: `material:${seed.sourceFileId}` }
      : undefined,
  })

  const setNumericValue = useCallback((key: NumericFieldKey, raw: string) => {
    setNumericValues((prev) => ({ ...prev, [key]: raw }))
  }, [])

  const invalidFieldKeys = useMemo(
    () => resolveInvalidFieldKeys(numericValues),
    [numericValues],
  )
  const hasInvalidParams = invalidFieldKeys.length > 0

  // 场景切分成功后其任务 id 才可作为抽帧入参；任务变更即旧抽帧结果失效
  const isSceneSplitDone = sceneSplit.status === 'success' && sceneSplit.task !== null
  const sceneTaskId = isSceneSplitDone && sceneSplit.task ? sceneSplit.task.id : ''

  // 抽帧（第二步）：来源为场景切分任务，故只在切分成功后可见；携带记录时预载其已产出的抽帧任务
  const frames = useFrameExtraction({ sceneTaskId, seed: seed?.frameTask })

  // 场景转写（第三步）：同样以场景切分任务为来源，不依赖抽帧，可与抽帧并行
  const transcription = useSceneTranscription({ sceneTaskId, seed: seed?.transcribeTask })

  // 抽帧成功后才可进入场景图像识别：其来源是抽帧产物
  const isFrameExtractDone = frames.status === 'success' && frames.task !== null
  const framesTaskId = isFrameExtractDone && frames.task ? frames.task.id : ''

  // 场景图像识别（第四步）：以抽帧任务为来源，整批共用 mode / prompt；携带记录时预载其已产出的识别任务
  const batch = useVlmBatch({
    framesTaskId,
    mode: batchMode,
    prompt: batchPrompt,
    seed: seed?.imageTask,
  })

  // 图像识别是否成功（视频理解的前置门闩）
  const isRecognizeDone = batch.status === 'success' && batch.task !== null

  // 视频理解（第五步）：把识别结果 + 转写文本拼 prompt 调 LLM 生成结构化中间层
  const understanding = useVideoUnderstanding({
    scenes: sceneSplit.scenes,
    itemsByScene: batch.itemsByScene,
    sceneSegments: transcription.sceneSegments,
    enabled: step === UNDERSTAND_STEP,
  })

  // 视频理解是否成功（解说生成的前置门闩）
  const isUnderstandDone =
    understanding.status === 'success' && understanding.segments !== null

  // 解说生成（第六步）：以视频理解结果为输入调 LLM 生成结构化解说
  const commentary = useVideoCommentary({
    segments: understanding.segments ?? EMPTY_UNDERSTANDING_SEGMENTS,
    enabled: step === COMMENTARY_STEP,
  })

  // 解说生成是否成功（视频解说的前置门闩）
  const isCommentaryDone = commentary.commentary !== null

  // 视频解说（第七步）：以结构化解说为输入，选音色与语速档位合成解说视频
  const narrationVideo = useNarrationVideo({
    sceneTaskId,
    narration: commentary.commentary,
    enabled: step === NARRATION_VIDEO_STEP,
  })

  const canEnterStep = useCallback(
    (index: number) => {
      if (index === 0) return true
      if (index === RECOGNIZE_STEP) return isFrameExtractDone
      if (index === UNDERSTAND_STEP) return isRecognizeDone
      if (index === COMMENTARY_STEP) return isUnderstandDone
      if (index === NARRATION_VIDEO_STEP) return isCommentaryDone
      return isSceneSplitDone
    },
    [isSceneSplitDone, isFrameExtractDone, isRecognizeDone, isUnderstandDone, isCommentaryDone],
  )

  const goPrev = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1))
  }, [])

  const goNext = useCallback(() => {
    setStep((prev) => (prev < LAST_STEP && canEnterStep(prev + 1) ? prev + 1 : prev))
  }, [canEnterStep])

  const goToStep = useCallback(
    (index: number) => {
      setStep((prev) => (index >= 0 && index <= LAST_STEP && canEnterStep(index) ? index : prev))
    },
    [canEnterStep],
  )

  return {
    step,
    material,
    setMaterial,
    detector,
    setDetector,
    numericValues,
    setNumericValue,
    invalidFieldKeys,
    hasInvalidParams,
    splitStatus: sceneSplit.status,
    isSplitting: sceneSplit.isGenerating,
    splitQueuePosition: sceneSplit.queuePosition,
    splitWaitingAhead: sceneSplit.waitingAhead,
    splitQueueDepth: sceneSplit.queueDepth,
    splitProgress: sceneSplit.progress,
    splitStageLabel: sceneSplit.stageLabel,
    splitError: sceneSplit.errorMessage,
    sceneSplitTask: sceneSplit.task,
    scenes: sceneSplit.scenes,
    scenesLoading: !isSceneSplitDone,
    split: sceneSplit.split,
    refreshTask: sceneSplit.refreshTask,
    frameStatus: frames.status,
    isExtractingFrames: frames.isGenerating,
    frameQueuePosition: frames.queuePosition,
    frameWaitingAhead: frames.waitingAhead,
    frameQueueDepth: frames.queueDepth,
    frameProgress: frames.progress,
    frameStageLabel: frames.stageLabel,
    frameError: frames.errorMessage,
    frameTask: frames.task,
    framesByScene: frames.framesByScene,
    frameCount: frames.frameCount,
    canExtractFrames: frames.canExtract,
    extractFrames: frames.extract,
    transcribeStatus: transcription.status,
    isTranscribing: transcription.isGenerating,
    transcribeQueuePosition: transcription.queuePosition,
    transcribeWaitingAhead: transcription.waitingAhead,
    transcribeQueueDepth: transcription.queueDepth,
    transcribeProgress: transcription.progress,
    transcribeStageLabel: transcription.stageLabel,
    transcribeError: transcription.errorMessage,
    transcribeTask: transcription.task,
    transcribeSceneSegments: transcription.sceneSegments,
    transcribeSegmentCount: transcription.segmentCount,
    canTranscribe: transcription.canTranscribe,
    transcribe: transcription.transcribe,
    batchStatus: batch.status,
    isRecognizing: batch.isGenerating,
    batchQueuePosition: batch.queuePosition,
    batchWaitingAhead: batch.waitingAhead,
    batchQueueDepth: batch.queueDepth,
    batchProgress: batch.progress,
    batchStageLabel: batch.stageLabel,
    batchError: batch.errorMessage,
    batchTask: batch.task,
    batchItemsByScene: batch.itemsByScene,
    batchTotal: batch.total,
    batchSucceeded: batch.succeeded,
    batchFailed: batch.failed,
    batchMode,
    setBatchMode,
    batchPrompt,
    setBatchPrompt,
    canRecognize: batch.canRecognize,
    recognize: batch.recognize,
    understanding,
    commentary,
    isCommentaryDone,
    narrationVideo,
    isSceneSplitDone,
    isFrameExtractDone,
    canEnterStep,
    goPrev,
    goNext,
    goToStep,
  }
}
