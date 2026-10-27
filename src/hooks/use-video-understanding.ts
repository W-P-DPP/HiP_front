import { useCallback } from 'react'

import { useLlmGeneration } from '@/hooks/use-llm-generation'
import type { LlmGenerationFormController } from '@/hooks/use-llm-generation'
import type { SceneSplitScene } from '@/types/scene-split'
import type { SceneTranscribeSceneSegments } from '@/types/scene-transcribe'
import type { VlmBatchItem } from '@/types/vlm-batch'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import {
  buildUnderstandingPrompt,
  parseUnderstandingSegments,
} from '@/utils/video-understanding'

/** useVideoUnderstanding 入参（均来自上游步骤的结果切片） */
export interface UseVideoUnderstandingOptions {
  /** 场景时间轴（源自场景切分） */
  scenes: readonly SceneSplitScene[]
  /** 按场景归组的画面识别结果（源自场景图像识别） */
  itemsByScene: ReadonlyMap<number, VlmBatchItem[]>
  /** 按场景归组的转写分段（源自场景转写） */
  sceneSegments: readonly SceneTranscribeSceneSegments[]
  /** 是否已进入本步骤（未进入时不请求平台/模型列表） */
  enabled?: boolean
}

/** 视频理解步骤的状态与动作（复用 /aiChat 流式对话接口） */
export interface VideoUnderstandingController extends LlmGenerationFormController {
  /** 解析出的结构化中间层片段，失败或未生成时为 null */
  segments: VideoUnderstandingSegment[] | null
  /** 模型原始返回文本（解析失败时回退展示） */
  rawText: string
}

/**
 * 视频理解生成：把识别结果 + 转写文本拼成 prompt，复用通用 LLM 生成能力得到结构化中间层。
 */
export function useVideoUnderstanding({
  scenes,
  itemsByScene,
  sceneSegments,
  enabled,
}: UseVideoUnderstandingOptions): VideoUnderstandingController {
  const buildPrompt = useCallback(
    (userPrompt: string) =>
      buildUnderstandingPrompt(userPrompt, scenes, itemsByScene, sceneSegments),
    [scenes, itemsByScene, sceneSegments],
  )

  const { result, ...form } = useLlmGeneration<VideoUnderstandingSegment[]>({
    enabled,
    dataReady: scenes.length > 0,
    buildPrompt,
    parse: parseUnderstandingSegments,
  })

  return { ...form, segments: result }
}
