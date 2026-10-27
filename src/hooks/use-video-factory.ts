import { useCallback, useEffect, useRef, useState } from 'react'

import { MAX_SCRIPT_LENGTH } from '@/constant/synthesis'
import { VIDEO_FACTORY_STEPS } from '@/constant/video-factory'
import type {
  SubtitleGenerationController,
  SubtitleGenerationStatus,
} from '@/hooks/use-subtitle-generation'
import { useSubtitleGeneration } from '@/hooks/use-subtitle-generation'
import type { VideoComposeController, VideoComposeStatus } from '@/hooks/use-video-compose'
import { useVideoCompose } from '@/hooks/use-video-compose'
import type { AudioSynthesisStatus, VoiceSynthesisController } from '@/hooks/use-voice-synthesis'
import { useVoiceSynthesis } from '@/hooks/use-voice-synthesis'
import type { VoiceTrainV2SpeedMode, VoiceTrainV2Voice } from '@/types/voice-train-v2'
import type { VideoFactorySeed } from '@/types/workbench'
import { parseSrt } from '@/utils/srt'

const LAST_STEP = VIDEO_FACTORY_STEPS.length - 1

/** 携带记录跳转时落到最远的可达步骤：缺哪一步就停在哪一步，避免落在被门闩锁住的步骤 */
function resolveStartStep(seed?: VideoFactorySeed): number {
  if (!seed) return 0
  if (!(seed.script.trim().length > 0 && seed.script.length < MAX_SCRIPT_LENGTH)) return 0
  if (!seed.audioFileId) return 1
  if (!seed.srtFileId) return 2
  if (!seed.keywords.length) return 3
  return LAST_STEP
}

/** 视频工厂流程的状态与动作（音频合成、字幕生成、视频合成接真实接口；关键词来自字幕预填与素材库选择） */
export interface VideoFactoryController {
  /** 当前步骤下标 */
  step: number
  /** 文案内容 */
  script: string
  setScript: (value: string) => void
  /** 文案是否满足进入下一步的条件（非空且未超长） */
  hasValidScript: boolean
  /** 当前用户音色列表 */
  voices: VoiceTrainV2Voice[]
  isLoadingVoices: boolean
  isVoicesError: boolean
  refetchVoices: () => void
  /** 选中的音色 id */
  voiceId: string
  setVoiceId: (value: string) => void
  /** 选中音色名称 */
  voiceName: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
  setSpeedMode: (value: VoiceTrainV2SpeedMode) => void
  /** 音频合成状态 */
  synthesisStatus: AudioSynthesisStatus
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 合成进度 0..1 */
  synthesisProgress: number
  /** 合成阶段中文描述 */
  synthesisStageLabel: string
  /** 合成失败原因 */
  synthesisError: string
  /** 已有成功结果但与当前音色/档位/文案不一致（需重新合成） */
  isAudioStale: boolean
  /** 合成音频地址，空串表示无有效结果 */
  audioUrl: string
  isSynthesizingAudio: boolean
  synthesizeAudio: () => void
  /** SRT 字幕文本，空串表示未生成 */
  subtitle: string
  isGeneratingSubtitle: boolean
  /** 字幕生成状态：idle 未提交，其余与后端任务状态一致 */
  subtitleStatus: SubtitleGenerationStatus
  /** 字幕任务排队位置，1 为队首；已出队执行或未提交时为 null */
  subtitleQueuePosition: number | null
  /** 字幕任务前方等待数与队列深度 */
  subtitleWaitingAhead: number
  subtitleQueueDepth: number
  /** 字幕识别进度 0..1 与阶段描述 */
  subtitleProgress: number
  subtitleStageLabel: string
  /** 字幕生成失败原因 */
  subtitleError: string
  generateSubtitle: () => void
  /** 关键词列表：字幕生成后按每条字幕文本预填，也可从素材库选择或手动增删 */
  keywords: string[]
  /** 追加关键词（去空、去重，已存在的不重复添加），用于素材库选择结果回填 */
  appendKeywords: (values: string[]) => void
  addKeyword: (value: string) => void
  removeKeyword: (value: string) => void
  /** 清空全部关键词 */
  clearKeywords: () => void
  /** 成品视频地址，空串表示无有效结果 */
  videoUrl: string
  /** 是否正在合成视频（提交中 / 排队中 / 合成中） */
  isComposingVideo: boolean
  /** 前序产物是否齐全，可提交合成 */
  canComposeVideo: boolean
  /** 视频合成状态：idle 未提交，其余与后端任务状态一致 */
  videoStatus: VideoComposeStatus
  /** 视频合成队列排位，1 为队首；已出队执行或未提交时为 null */
  videoQueuePosition: number | null
  videoWaitingAhead: number
  videoQueueDepth: number
  /** 合成进度 0..1 与阶段描述 */
  videoProgress: number
  videoStageLabel: string
  /** 合成失败原因 */
  videoError: string
  composeVideo: () => void
  /** 该步骤是否已解锁（可点击跳转） */
  canEnterStep: (index: number) => boolean
  goPrev: () => void
  goNext: () => void
  goToStep: (index: number) => void
}

/** 视频工厂流程状态机：集中管理五步的数据、门闩与生成动作 */
export function useVideoFactory(seed?: VideoFactorySeed): VideoFactoryController {
  const [step, setStep] = useState(() => resolveStartStep(seed))
  const [script, setScript] = useState(seed?.script ?? '')

  // 音频合成（第二步）：进入该步骤才拉取当前用户音色；携带记录跳转时一并放开门禁，
  // 以便摘要里能展示音色名称。
  const synthesis: VoiceSynthesisController = useVoiceSynthesis({
    text: script,
    enabled: step === 1 || Boolean(seed),
    seed: seed
      ? { voiceId: seed.voiceId, speedMode: seed.speedMode, audioTaskId: seed.voiceTaskId }
      : undefined,
  })

  // 字幕生成（第三步）：真实接口 + 两阶段轮询，源音频取自上一步音频合成产物
  const subtitleGen: SubtitleGenerationController = useSubtitleGeneration({
    sourceKey: synthesis.audioFileId,
    seed: seed ? { subtitleTaskId: seed.subtitleTaskId, fileId: seed.audioFileId } : undefined,
  })

  const [keywords, setKeywords] = useState<string[]>(seed?.keywords ?? [])

  // 视频合成（第五步）：真实接口 + 两阶段轮询，入参取自前序步骤产物
  const video: VideoComposeController = useVideoCompose({
    audioFileId: synthesis.audioFileId || seed?.audioFileId || '',
    srtFileId: subtitleGen.srtFileId || seed?.srtFileId || '',
    voiceId: synthesis.voiceId,
    text: script,
    speedMode: synthesis.speedMode,
    keywords,
    seed: seed ? { taskId: seed.taskId } : undefined,
  })

  const hasValidScript = script.trim().length > 0 && script.length < MAX_SCRIPT_LENGTH
  // 门闩带预填兜底：记录里已产出的产物即使轮询失败也不阻塞步骤跳转
  const hasAudio = synthesis.audioUrl !== '' || Boolean(seed?.audioFileId)
  const hasSubtitle = subtitleGen.subtitle !== '' || Boolean(seed?.srtFileId)
  const hasKeywords = keywords.length > 0

  /** 能否从某一步继续前进 */
  const canProceedFrom = useCallback(
    (index: number) => {
      switch (index) {
        case 0:
          return hasValidScript
        case 1:
          return hasAudio
        case 2:
          return hasSubtitle
        case 3:
          return hasKeywords
        default:
          return false
      }
    },
    [hasValidScript, hasAudio, hasSubtitle, hasKeywords],
  )

  const canEnterStep = useCallback(
    (index: number) => index === 0 || canProceedFrom(index - 1),
    [canProceedFrom],
  )

  // 字幕首次产出后，用字幕内容预填下一步关键词（保留原有联动行为）；
  // 携带记录跳转时关键词已按记录预填，跳过该联动以免被复用的字幕覆盖。
  const seededSubtitleRef = useRef('')
  const skipKeywordSeedRef = useRef(Boolean(seed))
  useEffect(() => {
    if (skipKeywordSeedRef.current) return
    const srt = subtitleGen.subtitle
    if (!srt || seededSubtitleRef.current === srt) return
    seededSubtitleRef.current = srt
    setKeywords(
      parseSrt(srt)
        .map((cue) => cue.text)
        .filter(Boolean),
    )
  }, [subtitleGen.subtitle])

  const appendKeywords = useCallback((values: string[]) => {
    setKeywords((prev) => {
      const next = [...prev]
      values.forEach((value) => {
        const keyword = value.trim()
        if (keyword && !next.includes(keyword)) next.push(keyword)
      })
      return next
    })
  }, [])

  const addKeyword = useCallback((value: string) => {
    const keyword = value.trim()
    if (!keyword) return
    setKeywords((prev) => (prev.includes(keyword) ? prev : [...prev, keyword]))
  }, [])

  const removeKeyword = useCallback((value: string) => {
    setKeywords((prev) => prev.filter((keyword) => keyword !== value))
  }, [])

  const clearKeywords = useCallback(() => {
    setKeywords([])
  }, [])

  const goPrev = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1))
  }, [])

  const goNext = useCallback(() => {
    setStep((prev) => (prev < LAST_STEP && canProceedFrom(prev) ? prev + 1 : prev))
  }, [canProceedFrom])

  const goToStep = useCallback(
    (index: number) => {
      setStep((prev) => (index >= 0 && index <= LAST_STEP && canEnterStep(index) ? index : prev))
    },
    [canEnterStep],
  )

  return {
    step,
    script,
    setScript,
    hasValidScript,
    voices: synthesis.voices,
    isLoadingVoices: synthesis.isLoadingVoices,
    isVoicesError: synthesis.isVoicesError,
    refetchVoices: synthesis.refetchVoices,
    voiceId: synthesis.voiceId,
    setVoiceId: synthesis.selectVoice,
    voiceName: synthesis.voiceName,
    speedMode: synthesis.speedMode,
    setSpeedMode: synthesis.setSpeedMode,
    synthesisStatus: synthesis.status,
    queuePosition: synthesis.queuePosition,
    waitingAhead: synthesis.waitingAhead,
    queueDepth: synthesis.queueDepth,
    synthesisProgress: synthesis.progress,
    synthesisStageLabel: synthesis.stageLabel,
    synthesisError: synthesis.errorMessage,
    isAudioStale: synthesis.isAudioStale,
    audioUrl: synthesis.audioUrl,
    isSynthesizingAudio: synthesis.isSynthesizing,
    synthesizeAudio: synthesis.synthesize,
    subtitle: subtitleGen.subtitle,
    isGeneratingSubtitle: subtitleGen.isGenerating,
    subtitleStatus: subtitleGen.status,
    subtitleQueuePosition: subtitleGen.queuePosition,
    subtitleWaitingAhead: subtitleGen.waitingAhead,
    subtitleQueueDepth: subtitleGen.queueDepth,
    subtitleProgress: subtitleGen.progress,
    subtitleStageLabel: subtitleGen.stageLabel,
    subtitleError: subtitleGen.errorMessage,
    generateSubtitle: subtitleGen.generate,
    keywords,
    appendKeywords,
    addKeyword,
    removeKeyword,
    clearKeywords,
    videoUrl: video.videoUrl,
    isComposingVideo: video.isComposing,
    canComposeVideo: video.canCompose,
    videoStatus: video.status,
    videoQueuePosition: video.queuePosition,
    videoWaitingAhead: video.waitingAhead,
    videoQueueDepth: video.queueDepth,
    videoProgress: video.progress,
    videoStageLabel: video.stageLabel,
    videoError: video.errorMessage,
    composeVideo: video.compose,
    canEnterStep,
    goPrev,
    goNext,
    goToStep,
  }
}
