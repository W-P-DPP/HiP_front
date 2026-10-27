import { useCallback } from 'react'

import { useLlmGeneration } from '@/hooks/use-llm-generation'
import type { LlmGenerationFormController } from '@/hooks/use-llm-generation'
import type { VideoCommentary } from '@/types/video-commentary'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import {
  buildCommentaryPrompt,
  parseVideoCommentary,
} from '@/utils/video-commentary'

/** useVideoCommentary 入参 */
export interface UseVideoCommentaryOptions {
  /** 视频理解的分段结果（本步输入）；为空时不可生成 */
  segments: readonly VideoUnderstandingSegment[]
  /** 是否已进入本步骤（未进入时不请求平台/模型列表） */
  enabled?: boolean
}

/** 解说生成步骤的状态与动作（复用 /aiChat 流式对话接口） */
export interface VideoCommentaryController extends LlmGenerationFormController {
  /** 解析出的结构化解说，失败或未生成时为 null */
  commentary: VideoCommentary | null
  /** 模型原始返回文本（解析失败时回退展示） */
  rawText: string
}

/**
 * 解说生成：把视频理解的分段结果拼成 prompt，复用通用 LLM 生成能力得到结构化解说。
 */
export function useVideoCommentary({
  segments,
  enabled,
}: UseVideoCommentaryOptions): VideoCommentaryController {
  const buildPrompt = useCallback(
    (userPrompt: string) => buildCommentaryPrompt(userPrompt, segments),
    [segments],
  )

  const { result, ...form } = useLlmGeneration<VideoCommentary>({
    enabled,
    dataReady: segments.length > 0,
    buildPrompt,
    parse: parseVideoCommentary,
  })

  return { ...form, commentary: result }
}
