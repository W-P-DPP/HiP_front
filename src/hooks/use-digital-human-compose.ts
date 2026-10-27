import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createDigitalHumanTask,
  digitalHumanQueryKeys,
  getDigitalHumanTaskDetail,
  getDigitalHumanTaskQueue,
} from '@/api/digital-human'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isDigitalHumanSynthesisFinished } from '@/types/digital-human'
import type { DigitalHumanSynthesisStatus } from '@/types/digital-human'
import { resolveMediaUrl } from '@/utils/media'

/** 数字人合成状态：idle 未提交，其余与后端任务状态一致 */
export type DigitalHumanComposeStatus = 'idle' | DigitalHumanSynthesisStatus

/** 已提交的合成任务快照：taskId 驱动轮询，signature 用于判定入参是否已变更 */
interface ActiveCompose {
  taskId: string
  signature: string
}

/** useDigitalHumanCompose 入参：全部来自前序步骤的选择与产物 */
export interface UseDigitalHumanComposeOptions {
  /** 上一步选中的数字人形象 id */
  avatarId: string
  /** 音频合成步骤选中的音色 id（音频由后端按 text + voiceId 重建） */
  voiceId: string
  /** 文案 */
  text: string
  /** 字幕生成步骤的任务 id（后端据此取 SRT 烧录进成品视频） */
  subtitleId: string
  /** 从合成记录跳转时的预填：复用其已完成的成品任务 */
  seed?: { taskId: string }
}

/** 数字人合成步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface DigitalHumanComposeController {
  /** 当前状态 */
  status: DigitalHumanComposeStatus
  /** 是否正在合成（提交中 / 排队中 / 合成中） */
  isComposing: boolean
  /** 入参是否齐全，可提交合成 */
  canCompose: boolean
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
  /** 成品视频地址，空串表示无有效结果 */
  videoUrl: string
  /** 成品视频的 file 记录 id，未成功时为空串 */
  videoFileId: string
  /** 提交合成任务 */
  compose: () => void
}

/**
 * 数字人合成流程：提交 with-subtitle 合成任务、两阶段轮询进度。
 *
 * 轮询分两段（都基于 TanStack Query，组件卸载时自动清除定时器）：
 * 1. 排队位置 `GET /digitalHuman/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null
 *    且 status 为 running）后停止；
 * 2. 任务状态 `GET /digitalHuman/tasks/:taskId`（10s）：出队后开始，进入终态后停止。
 * 任务 success 后按 resultUrl 展示成品视频。
 */
export function useDigitalHumanCompose({
  avatarId,
  voiceId,
  text,
  subtitleId,
  seed,
}: UseDigitalHumanComposeOptions): DigitalHumanComposeController {
  const trimmedText = text.trim()
  // 四个入参任一变更即视为旧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、结果清空），
  // 避免带着旧视频进入下一步。用派生判断代替 effect 重置，避免级联渲染。
  const signature = [avatarId, voiceId, trimmedText, subtitleId].join('|')

  // 预填时直接观察记录里的成品任务：入参已按记录预填，签名匹配即可展示原成品视频/失败原因
  const [active, setActive] = useState<ActiveCompose | null>(
    seed?.taskId ? { taskId: seed.taskId, signature } : null,
  )

  const isActiveMatch = active !== null && active.signature === signature
  const activeTaskId = isActiveMatch ? active.taskId : ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: digitalHumanQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getDigitalHumanTaskQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isDigitalHumanSynthesisFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isDigitalHumanSynthesisFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: digitalHumanQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getDigitalHumanTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isDigitalHumanSynthesisFinished(query.state.data?.status)
        ? false
        : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const composeMutation = useMutation({ mutationFn: createDigitalHumanTask })

  const task = taskQuery.data

  const status: DigitalHumanComposeStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isComposing =
    composeMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isDigitalHumanSynthesisFinished(status))

  const canCompose = Boolean(avatarId && voiceId && trimmedText && subtitleId)

  const compose = useCallback(() => {
    if (!canCompose || composeMutation.isPending) return
    composeMutation.mutate(
      {
        text: trimmedText,
        avatarId,
        voiceId,
        subtitleId,
      },
      {
        onSuccess: (accepted) => setActive({ taskId: accepted.taskId, signature }),
        // 失败提示已由 axios 拦截器统一处理
      },
    )
  }, [canCompose, composeMutation, trimmedText, avatarId, voiceId, subtitleId, signature])

  const hasResult = isActiveMatch && task?.status === 'success'

  return {
    status,
    isComposing,
    canCompose,
    queuePosition: queueQuery.data?.position ?? null,
    waitingAhead: queueQuery.data?.waitingAhead ?? 0,
    queueDepth: queueQuery.data?.queueDepth ?? 0,
    progress: task?.progress ?? 0,
    stageLabel: task?.stageLabel ?? '',
    errorMessage: task?.message ?? '',
    videoUrl: hasResult ? resolveMediaUrl(task?.resultUrl) : '',
    videoFileId: hasResult ? task?.resultFileId ?? '' : '',
    compose,
  }
}
