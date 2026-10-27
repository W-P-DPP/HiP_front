import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  digitalHumanQueryKeys,
  getDigitalHumanAvatarList,
} from '@/api/digital-human'
import {
  AVATAR_LIST_PAGE_SIZE,
  DIGITAL_HUMAN_FACTORY_STEPS,
} from '@/constant/digital-human-factory'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { MAX_SCRIPT_LENGTH } from '@/constant/synthesis'
import type {
  DigitalHumanComposeController,
  DigitalHumanComposeStatus,
} from '@/hooks/use-digital-human-compose'
import { useDigitalHumanCompose } from '@/hooks/use-digital-human-compose'
import type {
  SubtitleGenerationController,
  SubtitleGenerationStatus,
} from '@/hooks/use-subtitle-generation'
import { useSubtitleGeneration } from '@/hooks/use-subtitle-generation'
import type {
  AudioSynthesisStatus,
  VoiceSynthesisController,
} from '@/hooks/use-voice-synthesis'
import { useVoiceSynthesis } from '@/hooks/use-voice-synthesis'
import { useUserStore } from '@/store/user'
import type { DigitalHumanAvatar } from '@/types/digital-human'
import type { VoiceTrainV2SpeedMode, VoiceTrainV2Voice } from '@/types/voice-train-v2'
import type { DigitalHumanFactorySeed } from '@/types/workbench'

const LAST_STEP = DIGITAL_HUMAN_FACTORY_STEPS.length - 1

/** 携带记录跳转时落到最远的可达步骤：缺哪一步就停在哪一步，避免落在被门闩锁住的步骤 */
function resolveStartStep(seed?: DigitalHumanFactorySeed): number {
  if (!seed) return 0
  if (!(seed.script.trim().length > 0 && seed.script.length < MAX_SCRIPT_LENGTH)) return 0
  if (!seed.audioFileId) return 1
  if (!seed.subtitleTaskId) return 2
  if (!seed.avatarId) return 3
  return LAST_STEP
}

/** 数字人工厂流程的状态与动作（音频合成、字幕生成、形象选择、视频合成接真实接口） */
export interface DigitalHumanFactoryController {
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
  /** 速度档位（后端合成入参不含档位，固定 balanced，仅供预览音频使用） */
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
  /** 已有成功结果但与当前音色/文案不一致（需重新合成） */
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
  /** 当前用户的数字人形象列表 */
  avatars: DigitalHumanAvatar[]
  isLoadingAvatars: boolean
  isAvatarsError: boolean
  /** 形象列表重新拉取（上传新形象后调用） */
  refetchAvatars: () => void
  /** 选中的数字人形象 id */
  avatarId: string
  setAvatarId: (value: string) => void
  /** 选中形象名称 */
  avatarName: string
  /** 成品视频地址，空串表示无有效结果 */
  videoUrl: string
  /** 是否正在合成视频（提交中 / 排队中 / 合成中） */
  isComposingVideo: boolean
  /** 前序产物是否齐全，可提交合成 */
  canComposeVideo: boolean
  /** 视频合成状态：idle 未提交，其余与后端任务状态一致 */
  videoStatus: DigitalHumanComposeStatus
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

/**
 * 数字人工厂流程状态机：集中管理五步的数据、门闩与生成动作。
 * 前三步与短视频工厂共用同一批工序 hook（文案 → 音频合成 → 字幕生成），
 * 之后接数字人形象选择与「with-subtitle」视频合成。
 */
export function useDigitalHumanFactory(
  seed?: DigitalHumanFactorySeed,
): DigitalHumanFactoryController {
  const [step, setStep] = useState(() => resolveStartStep(seed))
  const [script, setScript] = useState(seed?.script ?? '')
  const [avatarId, setAvatarId] = useState(seed?.avatarId ?? '')

  const userId = useUserStore((state) => state.userId)

  // 音频合成（第二步）：进入该步骤才拉取当前用户音色；档位固定默认 balanced（后端入参不含档位）。
  // 携带记录跳转时一并放开门禁，以便摘要里能展示音色名称。
  const synthesis: VoiceSynthesisController = useVoiceSynthesis({
    text: script,
    enabled: step === 1 || Boolean(seed),
    seed: seed
      ? { voiceId: seed.voiceId, speedMode: seed.speedMode, audioTaskId: seed.audioTaskId }
      : undefined,
  })

  // 字幕生成（第三步）：源音频取自上一步合成产物，产出字幕任务 id 作为合成入参
  const subtitleGen: SubtitleGenerationController = useSubtitleGeneration({
    sourceKey: synthesis.audioFileId,
    seed: seed ? { subtitleTaskId: seed.subtitleTaskId, fileId: seed.audioFileId } : undefined,
  })

  // 形象选择（第四步）：进入该步骤才拉取当前用户形象，10s 轮询让页内新上传的形象自动出现
  const avatarsQuery = useQuery({
    queryKey: [...digitalHumanQueryKeys.avatars, userId, 'factory'],
    queryFn: () =>
      getDigitalHumanAvatarList({ userId, page: 1, limit: AVATAR_LIST_PAGE_SIZE }),
    enabled: (step === 3 || Boolean(seed)) && Boolean(userId),
    refetchInterval: LIST_POLL_INTERVAL,
  })

  // 视频合成（第五步）：音频由后端按 text + voiceId 重建，字幕按 subtitleId 烧录
  const compose: DigitalHumanComposeController = useDigitalHumanCompose({
    avatarId,
    voiceId: synthesis.voiceId,
    text: script,
    subtitleId: subtitleGen.subtitleTaskId || seed?.subtitleTaskId || '',
    seed: seed ? { taskId: seed.taskId } : undefined,
  })

  const hasValidScript = script.trim().length > 0 && script.length < MAX_SCRIPT_LENGTH
  // 门闩带预填兜底：记录里已产出的产物即使轮询失败也不阻塞步骤跳转（与 resolveStartStep 同源）
  const hasAudio = synthesis.audioUrl !== '' || Boolean(seed?.audioFileId)
  const hasSubtitle = subtitleGen.subtitle !== '' || Boolean(seed?.subtitleTaskId)
  const hasAvatar = avatarId !== ''

  const avatars = avatarsQuery.data?.list ?? []
  const avatarName = avatars.find((avatar) => avatar.id === avatarId)?.name ?? ''

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
          return hasAvatar
        default:
          return false
      }
    },
    [hasValidScript, hasAudio, hasSubtitle, hasAvatar],
  )

  const canEnterStep = useCallback(
    (index: number) => index === 0 || canProceedFrom(index - 1),
    [canProceedFrom],
  )

  const goPrev = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1))
  }, [])

  const goNext = useCallback(() => {
    setStep((prev) => (prev < LAST_STEP && canProceedFrom(prev) ? prev + 1 : prev))
  }, [canProceedFrom])

  const goToStep = useCallback(
    (index: number) => {
      setStep((prev) =>
        index >= 0 && index <= LAST_STEP && canEnterStep(index) ? index : prev,
      )
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
    avatars,
    isLoadingAvatars: avatarsQuery.isLoading,
    isAvatarsError: avatarsQuery.isError,
    refetchAvatars: avatarsQuery.refetch,
    avatarId,
    setAvatarId,
    avatarName,
    videoUrl: compose.videoUrl,
    isComposingVideo: compose.isComposing,
    canComposeVideo: compose.canCompose,
    videoStatus: compose.status,
    videoQueuePosition: compose.queuePosition,
    videoWaitingAhead: compose.waitingAhead,
    videoQueueDepth: compose.queueDepth,
    videoProgress: compose.progress,
    videoStageLabel: compose.stageLabel,
    videoError: compose.errorMessage,
    composeVideo: compose.compose,
    canEnterStep,
    goPrev,
    goNext,
    goToStep,
  }
}
