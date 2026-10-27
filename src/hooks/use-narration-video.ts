import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createNarrationVideoTask,
  getNarrationVideoTaskDetail,
  getNarrationVideoTaskQueue,
  narrationVideoQueryKeys,
} from '@/api/narration-video'
import { getVoiceTrainV2Voices, voiceTrainV2QueryKeys } from '@/api/voice-train-v2'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { VOICE_LIST_PAGE_SIZE } from '@/constant/synthesis'
import { useUserStore } from '@/store/user'
import { isNarrationVideoTaskFinished } from '@/types/narration-video'
import type {
  NarrationVideoTask,
  NarrationVideoTaskStatus,
} from '@/types/narration-video'
import type { VideoCommentary } from '@/types/video-commentary'
import type { VoiceTrainV2SpeedMode, VoiceTrainV2Voice } from '@/types/voice-train-v2'
import { resolveMediaUrl } from '@/utils/media'

/** 视频解说状态：idle 未提交，其余与后端任务状态一致 */
export type NarrationVideoStatus = 'idle' | NarrationVideoTaskStatus

/** 已提交的解说任务快照：taskId 驱动轮询，signature 用于判定入参是否已变更 */
interface ActiveNarration {
  taskId: string
  signature: string
}

/** useNarrationVideo 入参 */
export interface UseNarrationVideoOptions {
  /** 来源场景切分任务 id（来自场景切分步骤） */
  sceneTaskId: string
  /** 结构化解说（来自解说生成步骤），为空时不可提交 */
  narration: VideoCommentary | null
  /** 是否处于视频解说步骤：进入该步骤才拉取音色列表 */
  enabled: boolean
}

/** 视频解说步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface NarrationVideoController {
  /** 当前用户音色列表 */
  voices: VoiceTrainV2Voice[]
  isLoadingVoices: boolean
  isVoicesError: boolean
  /** 音色列表加载失败后重试 */
  refetchVoices: () => void
  /** 选中的音色 id */
  voiceId: string
  /** 选择音色（提交中不可切换） */
  selectVoice: (id: string) => void
  /** 选中音色名称 */
  voiceName: string
  /** 语速档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 切换语速档位（提交中不可切换） */
  setSpeedMode: (mode: VoiceTrainV2SpeedMode) => void
  /** 当前状态 */
  status: NarrationVideoStatus
  /** 是否正在处理（提交中 / 排队中 / 合成中） */
  isSubmitting: boolean
  /** 入参是否齐全，可提交 */
  canSubmit: boolean
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
  /** 任务详情（成功后含成品视频与字幕产物），无有效任务时为 null */
  task: NarrationVideoTask | null
  /** 成品视频地址，空串表示无有效结果 */
  videoUrl: string
  /** 字幕 SRT 地址，空串表示无有效结果 */
  srtUrl: string
  /** 提交视频解说任务 */
  submit: () => void
}

/**
 * 视频解说流程：拉取当前用户音色、提交解说任务、两阶段轮询进度。
 *
 * 轮询分两段（都基于 TanStack Query，组件卸载时自动清除定时器）：
 * 1. 排队位置 `GET /narrationVideo/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null
 *    且 status 为 running）后停止；
 * 2. 任务状态 `GET /narrationVideo/tasks/:taskId`（10s）：出队后开始，进入终态后停止。
 * 入参（场景任务/音色/档位/解说）变更即视为旧任务失效，避免带着旧成品视频进入展示。
 */
export function useNarrationVideo({
  sceneTaskId,
  narration,
  enabled,
}: UseNarrationVideoOptions): NarrationVideoController {
  const userId = useUserStore((state) => state.userId)

  const [voiceId, setVoiceId] = useState('')
  const [speedMode, setSpeedMode] = useState<VoiceTrainV2SpeedMode>('balanced')
  const [active, setActive] = useState<ActiveNarration | null>(null)

  const voicesQuery = useQuery({
    queryKey: [...voiceTrainV2QueryKeys.voices, userId, 'narration-video'],
    queryFn: () => getVoiceTrainV2Voices({ userId, page: 1, limit: VOICE_LIST_PAGE_SIZE }),
    enabled: enabled && Boolean(userId),
  })

  // 四个入参任一变更即视为旧任务失效：签名不匹配时不再观察其轮询，避免带着旧视频进入展示
  const signature = useMemo(
    () => [sceneTaskId, voiceId, speedMode, JSON.stringify(narration)].join('|'),
    [sceneTaskId, voiceId, speedMode, narration],
  )

  const isActiveMatch = active !== null && active.signature === signature
  const activeTaskId = isActiveMatch ? active.taskId : ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: narrationVideoQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getNarrationVideoTaskQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isNarrationVideoTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isNarrationVideoTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: narrationVideoQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getNarrationVideoTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isNarrationVideoTaskFinished(query.state.data?.status)
        ? false
        : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const submitMutation = useMutation({ mutationFn: createNarrationVideoTask })

  const task = taskQuery.data

  const status: NarrationVideoStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isSubmitting =
    submitMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isNarrationVideoTaskFinished(status))

  const canSubmit = Boolean(
    sceneTaskId && voiceId && narration && narration.segments.length > 0,
  )

  const submit = useCallback(() => {
    if (!canSubmit || !narration || submitMutation.isPending) return
    submitMutation.mutate(
      { sceneTaskId, voiceId, speedMode, narration },
      {
        onSuccess: (accepted) => setActive({ taskId: accepted.taskId, signature }),
        // 失败提示已由 axios 拦截器统一处理
      },
    )
  }, [canSubmit, narration, submitMutation, sceneTaskId, voiceId, speedMode, signature])

  const selectVoice = useCallback(
    (id: string) => {
      if (isSubmitting) return
      setVoiceId(id)
    },
    [isSubmitting],
  )

  const changeSpeedMode = useCallback(
    (mode: VoiceTrainV2SpeedMode) => {
      if (isSubmitting) return
      setSpeedMode(mode)
    },
    [isSubmitting],
  )

  const voiceName = useMemo(
    () => voicesQuery.data?.list.find((voice) => voice.id === voiceId)?.resourceName ?? '',
    [voicesQuery.data, voiceId],
  )

  const hasResult = isActiveMatch && task?.status === 'success'

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
    isSubmitting,
    canSubmit,
    queuePosition: queueQuery.data?.position ?? null,
    waitingAhead: queueQuery.data?.waitingAhead ?? 0,
    queueDepth: queueQuery.data?.queueDepth ?? 0,
    progress: task?.progress ?? 0,
    stageLabel: task?.stageLabel ?? '',
    errorMessage: task?.message ?? '',
    task: hasResult ? (task ?? null) : null,
    videoUrl: hasResult ? resolveMediaUrl(task?.videoUrl) : '',
    srtUrl: hasResult ? resolveMediaUrl(task?.srtUrl) : '',
    submit,
  }
}
