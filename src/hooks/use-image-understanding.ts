import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  getVlmTaskDetail,
  getVlmTaskQueue,
  vlmQueryKeys,
} from '@/api/vlm'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isVlmTaskFinished } from '@/types/vlm'
import type {
  VlmResult,
  VlmTask,
  VlmTaskAccepted,
  VlmTaskStatus,
} from '@/types/vlm'

/** 图像理解状态：idle 未提交，其余与后端任务状态一致 */
export type ImageUnderstandingStatus = 'idle' | VlmTaskStatus

/** 已提交的任务快照：taskId 驱动轮询，sourceKey 用于判定源是否已变更 */
interface ActiveVlmTask {
  taskId: string
  sourceKey: string
}

/** useImageUnderstanding 入参 */
export interface UseImageUnderstandingOptions {
  /** 源标识：变化即视为上一轮结果失效（上传传本地文件稳定标识，素材传 fileId）；为空时不可提交 */
  sourceKey: string
  /**
   * 自定义提交函数：上传场景传 () => createVlmTaskFromMedia(file, opts)；
   * 素材场景传 () => createVlmTaskFromMaterial(fileId, opts)。
   */
  submit?: () => Promise<VlmTaskAccepted>
}

/** 图像理解步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface ImageUnderstandingController {
  /** 当前状态 */
  status: ImageUnderstandingStatus
  /** 是否正在处理（提交中 / 排队中 / 理解中） */
  isGenerating: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 理解进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** 任务详情（成功后含 result / rawText）；未提交或结果失效时为 null */
  task: VlmTask | null
  /** 结构化结果，仅成功且 mode=json 时非空 */
  result: VlmResult | null
  /** 模型原始输出文本 */
  rawText: string
  /** 提交图像理解任务 */
  analyze: () => void
}

/**
 * 图像理解流程：提交任务、两阶段轮询进度（都基于 TanStack Query，组件卸载时自动清除定时器）。
 *
 * 1. 排队位置 `GET /vlm/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止；
 * 2. 任务状态 `GET /vlm/tasks/:taskId`（10s）：出队后开始，进入终态后停止，成功后携带 result。
 */
export function useImageUnderstanding({
  sourceKey,
  submit,
}: UseImageUnderstandingOptions): ImageUnderstandingController {
  const [active, setActive] = useState<ActiveVlmTask | null>(null)

  // 源变更后旧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、结果随之清空）。
  // 用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceKey === sourceKey
  const activeTaskId = isActiveMatch ? active.taskId : ''

  // 阶段一 · 排队位置
  const queueQuery = useQuery({
    queryKey: vlmQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getVlmTaskQueue(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isVlmTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isVlmTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: vlmQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getVlmTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isVlmTaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data ?? null

  const createMutation = useMutation({
    mutationFn: () => {
      if (!submit) throw new Error('缺少提交函数')
      return submit()
    },
  })

  const status: ImageUnderstandingStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isGenerating =
    createMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isVlmTaskFinished(status))

  const analyze = useCallback(() => {
    if (createMutation.isPending || !submit) return
    createMutation.mutate(undefined, {
      // 失败提示已由 axios 拦截器统一处理
      onSuccess: (accepted) => setActive({ taskId: accepted.taskId, sourceKey }),
    })
  }, [submit, sourceKey, createMutation])

  const isSuccess = isActiveMatch && task?.status === 'success'

  return {
    status,
    isGenerating,
    queuePosition: queueQuery.data?.position ?? null,
    waitingAhead: queueQuery.data?.waitingAhead ?? 0,
    queueDepth: queueQuery.data?.queueDepth ?? 0,
    progress: task?.progress ?? 0,
    stageLabel: task?.stageLabel ?? '',
    errorMessage: task?.message ?? '',
    task,
    result: isSuccess ? task.result : null,
    rawText: isSuccess ? task.rawText : '',
    analyze,
  }
}
