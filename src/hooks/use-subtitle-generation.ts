import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createSubtitleTask,
  getSubtitleSrtText,
  getSubtitleTaskDetail,
  getSubtitleTaskQueue,
  subtitleQueryKeys,
} from '@/api/subtitle'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isSubtitleTaskFinished } from '@/types/subtitle'
import type { SubtitleTaskAccepted, SubtitleTaskStatus } from '@/types/subtitle'

/** 字幕生成状态：idle 未提交，其余与后端任务状态一致 */
export type SubtitleGenerationStatus = 'idle' | SubtitleTaskStatus

/** 已提交的字幕任务快照：taskId 驱动轮询，sourceKey 用于判定源是否已变更 */
interface ActiveSubtitleTask {
  taskId: string
  sourceKey: string
}

/** 从合成记录跳转时的预填：复用其已完成的字幕子任务 */
export interface SubtitleGenerationSeed {
  /** 已完成的字幕子任务 id，空串表示不复用 */
  subtitleTaskId: string
  /** 该字幕任务对应的源音频 file 记录 id，需与上游音频产物一致才会被观察 */
  fileId: string
}

/** useSubtitleGeneration 入参 */
export interface UseSubtitleGenerationOptions {
  /**
   * 源标识：变化即视为上一轮结果失效（工厂传上一步音频产物的 file 记录 id；
   * 上传音视频场景传本地文件的稳定标识）。为空且未传 submit 时不可提交。
   */
  sourceKey: string
  /** 跳转预填：挂载时复用记录里的字幕子任务 */
  seed?: SubtitleGenerationSeed
  /**
   * 自定义提交函数。不传时用 createSubtitleTask({ fileId: sourceKey })（工厂场景）；
   * 上传音视频场景传 () => createSubtitleTaskFromMedia(file)。
   */
  submit?: () => Promise<SubtitleTaskAccepted>
}

/** 字幕生成步骤的状态与动作（真实接口 + 两阶段轮询 + SRT 文本拉取） */
export interface SubtitleGenerationController {
  /** 当前状态 */
  status: SubtitleGenerationStatus
  /** 是否正在生成（提交中 / 排队中 / 识别中） */
  isGenerating: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 识别进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** SRT 字幕文本，空串表示未生成 */
  subtitle: string
  /** SRT file 记录 id，作为下一步视频合成的入参；未成功或结果失效时为空串 */
  srtFileId: string
  /** SRT 地址（/api/files/:id/download），成功后非空，供下载使用 */
  srtUrl: string
  /** 字幕任务 id（作为数字人合成的 subtitleId 入参）；未成功或结果失效时为空串 */
  subtitleTaskId: string
  /** 提交生成任务 */
  generate: () => void
}

/**
 * 字幕生成流程：提交识别任务、两阶段轮询进度、成功后拉取 SRT 文本。
 *
 * 轮询分两段（都基于 TanStack Query，组件卸载时自动清除定时器）：
 * 1. 排队位置 `GET /subtitles/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止，对应需求「清除轮询位置定时器」；
 * 2. 任务状态 `GET /subtitles/tasks/:taskId`（10s）：出队后开始，进入终态后停止。
 * 任务 success 后再按 srtUrl 拉取 SRT 文本用于展示。
 */
export function useSubtitleGeneration({
  sourceKey,
  seed,
  submit,
}: UseSubtitleGenerationOptions): SubtitleGenerationController {
  // 预填时直接观察记录里的字幕子任务：终态后停止轮询，成功后拉取 SRT 文本
  const [active, setActive] = useState<ActiveSubtitleTask | null>(
    seed?.subtitleTaskId && seed.fileId
      ? { taskId: seed.subtitleTaskId, sourceKey: seed.fileId }
      : null,
  )

  // 源变更后旧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、subtitle 随之清空），
  // 避免带着旧字幕进入下一步。用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceKey === sourceKey
  const activeTaskId = isActiveMatch ? active.taskId : ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: subtitleQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getSubtitleTaskQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isSubtitleTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isSubtitleTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: subtitleQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getSubtitleTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isSubtitleTaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data

  // 阶段三 · SRT 文本：识别成功且拿到 srtUrl 后才请求
  const srtTextQuery = useQuery({
    queryKey: subtitleQueryKeys.srtText(activeTaskId),
    queryFn: () => getSubtitleSrtText(task?.srtUrl ?? ''),
    enabled: activeTaskId !== '' && task?.status === 'success' && Boolean(task.srtUrl),
  })

  // 提交方式：工厂用 fileId 建任务；上传音视频场景由 submit 覆盖为 from-media 直传
  const createMutation = useMutation({
    mutationFn: () => (submit ? submit() : createSubtitleTask({ fileId: sourceKey })),
  })

  const status: SubtitleGenerationStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  // 任务已成功但 SRT 文本仍在拉取时，继续按「生成中」处理，避免内容区闪一下空状态
  const isFetchingSrt =
    isActiveMatch && task?.status === 'success' && Boolean(task.srtUrl) && srtTextQuery.isLoading

  const isGenerating =
    createMutation.isPending ||
    isFetchingSrt ||
    (isActiveMatch && status !== 'idle' && !isSubtitleTaskFinished(status))

  const generate = useCallback(() => {
    if (createMutation.isPending) return
    if (!submit && !sourceKey) return
    createMutation.mutate(undefined, {
      onSuccess: (accepted) => setActive({ taskId: accepted.taskId, sourceKey }),
      // 失败提示已由 axios 拦截器统一处理
    })
  }, [submit, sourceKey, createMutation])

  return {
    status,
    isGenerating,
    queuePosition: queueQuery.data?.position ?? null,
    waitingAhead: queueQuery.data?.waitingAhead ?? 0,
    queueDepth: queueQuery.data?.queueDepth ?? 0,
    progress: task?.progress ?? 0,
    stageLabel: task?.stageLabel ?? '',
    errorMessage: task?.message ?? '',
    subtitle: srtTextQuery.data ?? '',
    srtFileId: activeTaskId !== '' && task?.status === 'success' ? task.srtFileId : '',
    srtUrl: activeTaskId !== '' && task?.status === 'success' ? task.srtUrl : '',
    subtitleTaskId: activeTaskId !== '' && task?.status === 'success' ? activeTaskId : '',
    generate,
  }
}
