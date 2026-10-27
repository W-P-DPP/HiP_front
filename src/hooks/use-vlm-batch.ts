import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createVlmBatchTask,
  getVlmBatchTaskDetail,
  getVlmBatchTaskQueue,
  vlmBatchQueryKeys,
} from '@/api/vlm-batch'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isVlmBatchTaskFinished } from '@/types/vlm-batch'
import type { VlmBatchItem, VlmBatchTask, VlmBatchTaskStatus } from '@/types/vlm-batch'

/** 批量图像识别状态：idle 未提交，其余与后端任务状态一致 */
export type VlmBatchStatus = 'idle' | VlmBatchTaskStatus

/** 已提交的任务快照：taskId 驱动轮询，sourceTaskId 用于判定来源抽帧任务是否已变更 */
interface ActiveBatchTask {
  taskId: string
  sourceTaskId: string
  /** 由记录跳转带入的初始任务：跳过排队阶段，直接拉取详情 */
  fromSeed: boolean
}

/** useVlmBatch 入参 */
export interface UseVlmBatchOptions {
  /** 来源抽帧任务 id；变化即视为上一轮识别结果失效。为空时不可提交 */
  framesTaskId: string
  /** 整批共用的输出模式（提交时传给后端） */
  mode: string
  /** 整批共用的提示词（留空则不传，由后端取默认） */
  prompt: string
  /** 从记录跳转带入的初始任务：sourceTaskId 需与当前来源一致，进入即拉取详情（含 items） */
  seed?: { taskId: string; sourceTaskId: string }
}

/** 批量图像识别步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface VlmBatchController {
  /** 当前状态 */
  status: VlmBatchStatus
  /** 是否正在处理（提交中 / 排队中 / 识别中） */
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
  /** 任务详情（成功后含 items）；未提交或结果失效时为 null */
  task: VlmBatchTask | null
  /** 按场景序号归组的逐项结果，仅成功时非空 */
  itemsByScene: ReadonlyMap<number, VlmBatchItem[]>
  /** 总项数 / 成功项数 / 失败项数，未成功时为 0 */
  total: number
  succeeded: number
  failed: number
  /** 是否可提交识别（来源抽帧任务已就绪） */
  canRecognize: boolean
  /** 提交批量图像识别任务 */
  recognize: () => void
}

const EMPTY_ITEMS_MAP: ReadonlyMap<number, VlmBatchItem[]> = new Map()

/**
 * 批量图像识别流程：以抽帧任务 id 提交识别任务、两阶段轮询进度
 * （都基于 TanStack Query，组件卸载时自动清除定时器）。
 *
 * 1. 排队位置 `GET /vlmBatch/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止；
 * 2. 任务状态 `GET /vlmBatch/tasks/:taskId`（10s）：出队后开始，进入终态后停止，成功后携带 items。
 */
export function useVlmBatch({
  framesTaskId,
  mode,
  prompt,
  seed,
}: UseVlmBatchOptions): VlmBatchController {
  // 携带记录跳转时以该任务为初始活动任务，进入即拉取详情（含 items）
  const [active, setActive] = useState<ActiveBatchTask | null>(() =>
    seed ? { taskId: seed.taskId, sourceTaskId: seed.sourceTaskId, fromSeed: true } : null,
  )

  // 来源抽帧任务变更后旧识别任务失效：不再观察其轮询（taskId 置空 → 查询禁用、结果随之清空）。
  // 用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceTaskId === framesTaskId
  const activeTaskId = isActiveMatch ? active.taskId : ''
  // 记录带入的任务已是观察对象（无排队阶段），跳过队列查询直接拉详情
  const isSeedActive = isActiveMatch && active.fromSeed

  // 阶段一 · 排队位置（记录带入的任务跳过）
  const queueQuery = useQuery({
    queryKey: vlmBatchQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getVlmBatchTaskQueue(activeTaskId),
    enabled: activeTaskId !== '' && !isSeedActive,
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isVlmBatchTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isVlmBatchTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：记录带入或出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: vlmBatchQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getVlmBatchTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isSeedActive || isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isVlmBatchTaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data ?? null

  const createMutation = useMutation({
    mutationFn: () =>
      createVlmBatchTask({
        taskId: framesTaskId,
        mode,
        prompt: prompt.trim() || undefined,
      }),
  })

  const status: VlmBatchStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    // 记录带入：详情未就绪时按进行中展示，避免出现「排队中 · 第 - 位」的空态文案
    if (isSeedActive) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isGenerating =
    createMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isVlmBatchTaskFinished(status))

  const recognize = useCallback(() => {
    if (createMutation.isPending || !framesTaskId) return
    createMutation.mutate(undefined, {
      // 失败提示已由 axios 拦截器统一处理
      onSuccess: (accepted) =>
        setActive({ taskId: accepted.taskId, sourceTaskId: framesTaskId, fromSeed: false }),
    })
  }, [framesTaskId, createMutation])

  const isSuccess = isActiveMatch && task?.status === 'success'

  const itemsByScene = useMemo<ReadonlyMap<number, VlmBatchItem[]>>(() => {
    if (!isSuccess || !task) return EMPTY_ITEMS_MAP
    const map = new Map<number, VlmBatchItem[]>()
    task.items.forEach((item) => {
      const group = map.get(item.sceneIndex)
      if (group) group.push(item)
      else map.set(item.sceneIndex, [item])
    })
    return map
  }, [isSuccess, task])

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
    itemsByScene,
    total: isSuccess && task ? task.total : 0,
    succeeded: isSuccess && task ? task.succeeded : 0,
    failed: isSuccess && task ? task.failed : 0,
    canRecognize: framesTaskId !== '',
    recognize,
  }
}
