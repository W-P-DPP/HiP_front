import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  composeVideoPipelineV2Task,
  getVideoPipelineV2TaskDetail,
  getVideoPipelineV2TaskQueue,
  videoPipelineV2QueryKeys,
} from '@/api/video-pipeline-v2'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isVideoPipelineV2TaskFinished } from '@/types/video-pipeline-v2'
import type { VideoPipelineV2TaskStatus } from '@/types/video-pipeline-v2'
import { resolveMediaUrl } from '@/utils/media'

/** 视频合成状态：idle 未提交，其余与后端任务状态一致 */
export type VideoComposeStatus = 'idle' | VideoPipelineV2TaskStatus

/** 已提交的合成任务快照：taskId 驱动轮询，signature 用于判定入参是否已变更 */
interface ActiveCompose {
  taskId: string
  signature: string
}

/** useVideoCompose 入参：全部来自前序步骤的产物 */
export interface UseVideoComposeOptions {
  /** 上一步音频合成产物的 file 记录 id */
  audioFileId: string
  /** 上一步字幕生成产物的 SRT file 记录 id */
  srtFileId: string
  /** 选中的音色 id */
  voiceId: string
  /** 待合成文案 */
  text: string
  /** 速度档位 */
  speedMode: string
  /** 每段字幕对应的素材搜索词 */
  keywords: string[]
  /** 从合成记录跳转时的预填：复用其已完成的成品任务 */
  seed?: { taskId: string }
}

/** 视频合成步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface VideoComposeController {
  /** 当前状态 */
  status: VideoComposeStatus
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
 * 视频合成流程：提交合成任务、两阶段轮询进度。
 *
 * 轮询分两段（都基于 TanStack Query，组件卸载时自动清除定时器）：
 * 1. 排队位置 `GET /videoPipelineV2/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null
 *    且 status 为 running）后停止，对应需求「清除轮询位置定时器」；
 * 2. 任务状态 `GET /videoPipelineV2/tasks/:taskId`（10s）：出队后开始，进入终态后停止。
 * 任务 success 后按 videoUrl 展示成品视频。
 */
export function useVideoCompose({
  audioFileId,
  srtFileId,
  voiceId,
  text,
  speedMode,
  keywords,
  seed,
}: UseVideoComposeOptions): VideoComposeController {
  const trimmedText = text.trim()
  // 六个入参任一变更即视为旧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、结果清空），
  // 避免带着旧视频进入下一步。用派生判断代替 effect 重置，避免级联渲染。
  const signature = [
    audioFileId,
    srtFileId,
    voiceId,
    trimmedText,
    speedMode,
    keywords.join('\n'),
  ].join('|')

  // 预填时直接观察记录里的成品任务：入参已按记录预填，签名匹配即可展示原成品视频/失败原因
  const [active, setActive] = useState<ActiveCompose | null>(
    seed?.taskId ? { taskId: seed.taskId, signature } : null,
  )

  const isActiveMatch = active !== null && active.signature === signature
  const activeTaskId = isActiveMatch ? active.taskId : ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: videoPipelineV2QueryKeys.taskQueue(activeTaskId),
    queryFn: () => getVideoPipelineV2TaskQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isVideoPipelineV2TaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isVideoPipelineV2TaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: videoPipelineV2QueryKeys.taskDetail(activeTaskId),
    queryFn: () => getVideoPipelineV2TaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isVideoPipelineV2TaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const composeMutation = useMutation({ mutationFn: composeVideoPipelineV2Task })

  const task = taskQuery.data

  const status: VideoComposeStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isComposing =
    composeMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isVideoPipelineV2TaskFinished(status))

  const canCompose = Boolean(
    audioFileId && srtFileId && voiceId && trimmedText && keywords.length > 0,
  )

  const compose = useCallback(() => {
    if (!canCompose || composeMutation.isPending) return
    composeMutation.mutate(
      {
        audioFileId,
        srtFileId,
        voiceId,
        text: trimmedText,
        speedMode,
        keywords,
      },
      {
        onSuccess: (accepted) => setActive({ taskId: accepted.taskId, signature }),
        // 失败提示已由 axios 拦截器统一处理
      },
    )
  }, [
    canCompose,
    composeMutation,
    audioFileId,
    srtFileId,
    voiceId,
    trimmedText,
    speedMode,
    keywords,
    signature,
  ])

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
    videoUrl: hasResult ? resolveMediaUrl(task?.videoUrl) : '',
    videoFileId: hasResult ? task?.videoFileId ?? '' : '',
    compose,
  }
}
