import type { AudioSynthesisStatus } from '@/hooks/use-voice-synthesis'
import type { SubtitleGenerationStatus } from '@/hooks/use-subtitle-generation'
import type {
  VoiceTrainV2SpeedMode,
  VoiceTrainV2Voice,
} from '@/types/voice-train-v2'

/**
 * 各合成工序步骤所需的控制器切片。
 * 字段名与 useVideoFactory / useDigitalHumanFactory 的控制器一致，两个控制器都能直接传入。
 */

/** 步骤 · 文案 */
export interface ScriptStageController {
  script: string
  setScript: (value: string) => void
  /** 文案是否满足进入下一步的条件（非空且未超长） */
  hasValidScript: boolean
  goNext: () => void
}

/** 步骤 · 音频合成 */
export interface VoiceSynthesisStageController {
  voices: VoiceTrainV2Voice[]
  isLoadingVoices: boolean
  isVoicesError: boolean
  refetchVoices: () => void
  voiceId: string
  setVoiceId: (value: string) => void
  voiceName: string
  speedMode: VoiceTrainV2SpeedMode
  setSpeedMode: (value: VoiceTrainV2SpeedMode) => void
  synthesisStatus: AudioSynthesisStatus
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  waitingAhead: number
  queueDepth: number
  synthesisProgress: number
  synthesisStageLabel: string
  synthesisError: string
  isAudioStale: boolean
  audioUrl: string
  isSynthesizingAudio: boolean
  synthesizeAudio: () => void
  goPrev: () => void
  goNext: () => void
}

/** 步骤 · 字幕生成 */
export interface SubtitleStageController {
  subtitle: string
  isGeneratingSubtitle: boolean
  subtitleStatus: SubtitleGenerationStatus
  subtitleQueuePosition: number | null
  subtitleWaitingAhead: number
  subtitleQueueDepth: number
  subtitleProgress: number
  subtitleStageLabel: string
  subtitleError: string
  generateSubtitle: () => void
  audioUrl: string
  goPrev: () => void
  goNext: () => void
}
