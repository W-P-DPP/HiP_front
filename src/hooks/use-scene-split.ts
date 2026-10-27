import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  getSceneSplitTaskDetail,
  getSceneSplitTaskQueue,
  sceneSplitQueryKeys,
} from '@/api/scene-split'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isSceneSplitTaskFinished } from '@/types/scene-split'
import type {
  SceneSplitScene,
  SceneSplitTask,
  SceneSplitTaskAccepted,
  SceneSplitTaskStatus,
} from '@/types/scene-split'

/** 场景切分状态：idle 未提交，其余与后端任务状态一致 */
export type SceneSplitStatus = 'idle' | SceneSplitTaskStatus

/** 已提交的任务快照：taskId 驱动轮询，sourceKey 用于判定源是否已变更 */
interface ActiveSceneSplitTask {
  taskId: string
  sourceKey: string
  /** 由记录跳转带入的初始任务：跳过排队阶段，直接拉取详情 */
  fromSeed: boolean
}

/** useSceneSplit 入参 */
export interface UseSceneSplitOptions {
  /** 源标识：素材场景传 fileId；变化即视为上一轮结果失效。为空时不可提交 */
  sourceKey: string
  /** 提交函数：() => createSceneSplitTask({ fileId, ...detectOptions }) */
  submit?: () => Promise<SceneSplitTaskAccepted>
  /** 从记录跳转带入的初始任务：sourceKey 需与其源标识一致，进入即拉取详情（含 scenes） */
  seed?: { taskId: string; sourceKey: string }
}

/** 场景切分步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface SceneSplitController {
  /** 当前状态 */
  status: SceneSplitStatus
  /** 是否正在处理（提交中 / 排队中 / 切分中） */
  isGenerating: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 切分进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** 任务详情（成功后含 scenes）；未提交或结果失效时为 null */
  task: SceneSplitTask | null
  /** 场景列表，仅成功时非空 */
  scenes: SceneSplitScene[]
  /** 提交场景切分任务 */
  split: () => void
  /** 重新拉取任务详情（场景被就地修改后刷新 scenes，如合并场景） */
  refreshTask: () => void
}

/**
 * 场景切分流程：提交任务、两阶段轮询进度（都基于 TanStack Query，组件卸载时自动清除定时器）。
 *
 * 1. 排队位置 `GET /aiDetect/scene/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止；
 * 2. 任务状态 `GET /aiDetect/scene/tasks/:taskId`（10s）：出队后开始，进入终态后停止，成功后携带 scenes。
 *
 * 携带记录跳转（seed）时以该任务为初始观察对象，跳过排队阶段直接拉取详情。
 */
export function useSceneSplit({
  sourceKey,
  submit,
  seed,
}: UseSceneSplitOptions): SceneSplitController {
  // 携带记录跳转时以该任务为初始活动任务，进入即拉取详情（含 scenes）
  const [active, setActive] = useState<ActiveSceneSplitTask | null>(() =>
    seed ? { taskId: seed.taskId, sourceKey: seed.sourceKey, fromSeed: true } : null,
  )

  // 源变更后旧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、场景列表随之清空）。
  // 用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceKey === sourceKey
  const activeTaskId = isActiveMatch ? active.taskId : ''
  // 记录带入的任务已是观察对象（无排队阶段），跳过队列查询直接拉详情
  const isSeedActive = isActiveMatch && active.fromSeed

  // 阶段一 · 排队位置（记录带入的任务跳过）
  const queueQuery = useQuery({
    queryKey: sceneSplitQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getSceneSplitTaskQueue(activeTaskId),
    enabled: activeTaskId !== '' && !isSeedActive,
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isSceneSplitTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isSceneSplitTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：记录带入或出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: sceneSplitQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getSceneSplitTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isSeedActive || isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isSceneSplitTaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data ?? null
  const { refetch: refetchTask } = taskQuery

  // 场景就地修改（如合并）后重新拉任务详情：成功后队列已是终态，taskQuery 仍处于 enabled，可直接 refetch
  const refreshTask = useCallback(() => {
    void refetchTask()
  }, [refetchTask])

  const createMutation = useMutation({
    mutationFn: () => {
      if (!submit) throw new Error('缺少提交函数')
      return submit()
    },
  })

  const status: SceneSplitStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    // 记录带入：详情未就绪时按进行中展示，避免出现「排队中 · 第 - 位」的空态文案
    if (isSeedActive) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isGenerating =
    createMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isSceneSplitTaskFinished(status))

  const split = useCallback(() => {
    if (createMutation.isPending || !submit) return
    createMutation.mutate(undefined, {
      // 失败提示已由 axios 拦截器统一处理
      onSuccess: (accepted) =>
        setActive({ taskId: accepted.taskId, sourceKey, fromSeed: false }),
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
    scenes: isSuccess ? task.scenes : [],
    split,
    refreshTask,
  }
}
