import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  getVoiceTrainV2SynthesisQueue,
  getVoiceTrainV2SynthesisTask,
  getVoiceTrainV2Voices,
  synthesizeVoiceTrainV2,
  voiceTrainV2QueryKeys,
} from '@/api/voice-train-v2'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { VOICE_LIST_PAGE_SIZE } from '@/constant/synthesis'
import { useUserStore } from '@/store/user'
import { isVoiceTrainV2SynthesisFinished } from '@/types/voice-train-v2'
import type {
  VoiceTrainV2SpeedMode,
  VoiceTrainV2SynthesisStatus,
  VoiceTrainV2Voice,
} from '@/types/voice-train-v2'
import { resolveMediaUrl } from '@/utils/media'

/** 音频合成状态：idle 未提交，其余与后端任务状态一致 */
export type AudioSynthesisStatus = 'idle' | VoiceTrainV2SynthesisStatus

/** 已提交的合成任务快照：taskId 驱动轮询，其余字段用于判定结果是否仍与当前选择一致 */
interface ActiveSynthesis {
  taskId: string
  voiceId: string
  speedMode: VoiceTrainV2SpeedMode
  text: string
}

/** 从合成记录跳转时的预填：选中音色 + 复用其已完成的音频子任务 */
export interface VoiceSynthesisSeed {
  /** 音色 id */
  voiceId: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 已完成的音频子任务 id，空串表示不复用 */
  audioTaskId: string
}

/** useVoiceSynthesis 入参 */
export interface UseVoiceSynthesisOptions {
  /** 待合成文案（来自上一步） */
  text: string
  /** 是否处于音频合成步骤：进入该步骤才拉取音色列表 */
  enabled: boolean
  /** 跳转预填：挂载时选中音色并复用记录里的音频子任务 */
  seed?: VoiceSynthesisSeed
}

/** 音频合成步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface VoiceSynthesisController {
  /** 当前用户音色列表 */
  voices: VoiceTrainV2Voice[]
  isLoadingVoices: boolean
  isVoicesError: boolean
  /** 音色列表加载失败后重试 */
  refetchVoices: () => void
  /** 选中的音色 id */
  voiceId: string
  /** 选择音色（合成进行中不可切换） */
  selectVoice: (id: string) => void
  /** 选中音色名称 */
  voiceName: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 切换速度档位（合成进行中不可切换） */
  setSpeedMode: (mode: VoiceTrainV2SpeedMode) => void
  /** 当前合成状态 */
  status: AudioSynthesisStatus
  /** 是否正在合成（提交中 / 排队中 / 合成中） */
  isSynthesizing: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 合成进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** 合成成功的试听地址，仅当结果与当前音色/档位/文案一致时非空 */
  audioUrl: string
  /** 合成音频的 file 记录 id，作为下一步字幕任务的入参；结果不一致或未成功时为空串 */
  audioFileId: string
  /** 已有成功结果，但与当前音色/档位/文案不一致（需重新合成） */
  isAudioStale: boolean
  /** 提交合成任务 */
  synthesize: () => void
}

/**
 * 音频合成流程：拉取当前用户音色、提交合成、两阶段轮询进度。
 *
 * 轮询分两段（都基于 TanStack Query，组件卸载时自动清除定时器）：
 * 1. 排队位置 `GET /synthesize/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止，对应需求「清除轮询位置定时器」；
 * 2. 任务状态 `GET /synthesize/:taskId`（10s）：出队后开始，进入终态后停止。
 */
export function useVoiceSynthesis({
  text,
  enabled,
  seed,
}: UseVoiceSynthesisOptions): VoiceSynthesisController {
  const userId = useUserStore((state) => state.userId)

  const [voiceId, setVoiceId] = useState(seed?.voiceId ?? '')
  const [speedMode, setSpeedMode] = useState<VoiceTrainV2SpeedMode>(seed?.speedMode ?? 'balanced')
  // 预填时直接观察记录里的音频子任务：终态后停止轮询，结果按 isResultFresh 判定是否仍有效
  const [active, setActive] = useState<ActiveSynthesis | null>(
    seed?.audioTaskId
      ? {
          taskId: seed.audioTaskId,
          voiceId: seed.voiceId,
          speedMode: seed.speedMode,
          text: text.trim(),
        }
      : null,
  )

  const voicesQuery = useQuery({
    queryKey: [...voiceTrainV2QueryKeys.voices, userId, 'factory'],
    queryFn: () => getVoiceTrainV2Voices({ userId, page: 1, limit: VOICE_LIST_PAGE_SIZE }),
    enabled: enabled && Boolean(userId),
  })

  const activeTaskId = active?.taskId ?? ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: voiceTrainV2QueryKeys.synthesisQueue(activeTaskId),
    queryFn: () => getVoiceTrainV2SynthesisQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isVoiceTrainV2SynthesisFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isVoiceTrainV2SynthesisFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: voiceTrainV2QueryKeys.synthesisTask(activeTaskId),
    queryFn: () => getVoiceTrainV2SynthesisTask(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isVoiceTrainV2SynthesisFinished(query.state.data?.status)
        ? false
        : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const synthesizeMutation = useMutation({ mutationFn: synthesizeVoiceTrainV2 })

  const task = taskQuery.data
  const status: AudioSynthesisStatus = (() => {
    if (!active) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isSynthesizing =
    synthesizeMutation.isPending ||
    (active !== null && status !== 'idle' && !isVoiceTrainV2SynthesisFinished(status))

  const synthesize = useCallback(() => {
    const trimmed = text.trim()
    if (!voiceId || !trimmed || synthesizeMutation.isPending) return
    synthesizeMutation.mutate(
      { voiceId, text: trimmed, speedMode },
      {
        onSuccess: (accepted) => {
          setActive({ taskId: accepted.taskId, voiceId, speedMode, text: trimmed })
        },
        // 失败提示已由 axios 拦截器统一处理
      },
    )
  }, [voiceId, text, speedMode, synthesizeMutation])

  const selectVoice = useCallback(
    (id: string) => {
      if (isSynthesizing) return
      setVoiceId(id)
    },
    [isSynthesizing],
  )

  const changeSpeedMode = useCallback(
    (mode: VoiceTrainV2SpeedMode) => {
      if (isSynthesizing) return
      setSpeedMode(mode)
    },
    [isSynthesizing],
  )

  const voiceName = useMemo(
    () => voicesQuery.data?.list.find((voice) => voice.id === voiceId)?.resourceName ?? '',
    [voicesQuery.data, voiceId],
  )

  // 任务返回体自带 voiceId/speedMode/text，三者与当前一致才认为结果仍有效，
  // 避免改文案/换音色后仍能带着旧音频进入下一步。
  const isResultFresh =
    task?.status === 'success' &&
    task.voiceId === voiceId &&
    task.speedMode === speedMode &&
    task.text === text.trim()
  const hasResult = task?.status === 'success'

  return {
    voices: voicesQuery.data?.list ?? [],
    isLoadingVoices: voicesQuery.isLoading,
    isVoicesError: voicesQuery.isError,
    refetchVoices: voicesQuery.refetch,
    voiceId,
    selectVoice,
    voiceName,
    speedMode,
    setSpeedMode: changeSpeedMode,
    status,
    isSynthesizing,
    queuePosition: queueQuery.data?.position ?? null,
    waitingAhead: queueQuery.data?.waitingAhead ?? 0,
    queueDepth: queueQuery.data?.queueDepth ?? 0,
    progress: task?.progress ?? 0,
    stageLabel: task?.stageLabel ?? '',
    errorMessage: task?.message ?? '',
    audioUrl: isResultFresh ? resolveMediaUrl(task?.resultUrl) : '',
    audioFileId: isResultFresh ? task?.resultFileId ?? '' : '',
    isAudioStale: Boolean(hasResult) && !isResultFresh,
    synthesize,
  }
}
