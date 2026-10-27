import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createFrameExtractTask,
  frameExtractQueryKeys,
  getFrameExtractTaskDetail,
  getFrameExtractTaskQueue,
} from '@/api/frame-extract'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isFrameExtractTaskFinished } from '@/types/frame-extract'
import type {
  FrameExtractTask,
  FrameExtractTaskStatus,
  FrameSceneGroup,
} from '@/types/frame-extract'

/** 抽帧状态：idle 未提交，其余与后端任务状态一致 */
export type FrameExtractStatus = 'idle' | FrameExtractTaskStatus

/** 已提交的任务快照：taskId 驱动轮询，sourceTaskId 用于判定来源场景任务是否已变更 */
interface ActiveFrameTask {
  taskId: string
  sourceTaskId: string
  /** 由记录跳转带入的初始任务：跳过排队阶段，直接拉取详情 */
  fromSeed: boolean
}

/** useFrameExtraction 入参 */
export interface UseFrameExtractionOptions {
  /** 来源场景切分任务 id；变化即视为上一轮抽帧结果失效。为空时不可提交 */
  sceneTaskId: string
  /** 从记录跳转带入的初始任务：sourceTaskId 需与当前来源一致，进入即拉取详情（含 frames） */
  seed?: { taskId: string; sourceTaskId: string }
}

/** 抽帧步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface FrameExtractionController {
  /** 当前状态 */
  status: FrameExtractStatus
  /** 是否正在处理（提交中 / 排队中 / 抽帧中） */
  isGenerating: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 抽帧进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** 任务详情（成功后含 frames）；未提交或结果失效时为 null */
  task: FrameExtractTask | null
  /** 按场景序号索引的抽帧结果，仅成功且命中时有值 */
  framesByScene: ReadonlyMap<number, FrameSceneGroup>
  /** 抽出的总帧数，未成功时为 0 */
  frameCount: number
  /** 是否可提交抽帧（来源场景任务已就绪） */
  canExtract: boolean
  /** 提交抽帧任务 */
  extract: () => void
}

const EMPTY_FRAME_MAP: ReadonlyMap<number, FrameSceneGroup> = new Map()

/**
 * 抽帧流程：以场景切分任务 id 提交抽帧任务、两阶段轮询进度
 * （都基于 TanStack Query，组件卸载时自动清除定时器）。
 *
 * 1. 排队位置 `GET /aiDetect/frames/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止；
 * 2. 任务状态 `GET /aiDetect/frames/tasks/:taskId`（10s）：出队后开始，进入终态后停止，成功后携带 frames。
 */
export function useFrameExtraction({
  sceneTaskId,
  seed,
}: UseFrameExtractionOptions): FrameExtractionController {
  // 携带记录跳转时以该任务为初始活动任务，进入即拉取详情（含 frames）
  const [active, setActive] = useState<ActiveFrameTask | null>(() =>
    seed ? { taskId: seed.taskId, sourceTaskId: seed.sourceTaskId, fromSeed: true } : null,
  )

  // 来源场景任务变更后旧抽帧任务失效：不再观察其轮询（taskId 置空 → 查询禁用、frames 随之清空）。
  // 用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceTaskId === sceneTaskId
  const activeTaskId = isActiveMatch ? active.taskId : ''
  // 记录带入的任务已是观察对象（无排队阶段），跳过队列查询直接拉详情
  const isSeedActive = isActiveMatch && active.fromSeed

  // 阶段一 · 排队位置（记录带入的任务跳过）
  const queueQuery = useQuery({
    queryKey: frameExtractQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getFrameExtractTaskQueue(activeTaskId),
    enabled: activeTaskId !== '' && !isSeedActive,
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isFrameExtractTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isFrameExtractTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：记录带入或出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: frameExtractQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getFrameExtractTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isSeedActive || isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isFrameExtractTaskFinished(query.state.data?.status) ? false : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data ?? null

  const createMutation = useMutation({
    mutationFn: () => createFrameExtractTask({ taskId: sceneTaskId }),
  })

  const status: FrameExtractStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    // 记录带入：详情未就绪时按进行中展示，避免出现「排队中 · 第 - 位」的空态文案
    if (isSeedActive) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isGenerating =
    createMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isFrameExtractTaskFinished(status))

  const extract = useCallback(() => {
    if (createMutation.isPending || !sceneTaskId) return
    createMutation.mutate(undefined, {
      // 失败提示已由 axios 拦截器统一处理
      onSuccess: (accepted) =>
        setActive({ taskId: accepted.taskId, sourceTaskId: sceneTaskId, fromSeed: false }),
    })
  }, [sceneTaskId, createMutation])

  const isSuccess = isActiveMatch && task?.status === 'success'

  const framesByScene = useMemo<ReadonlyMap<number, FrameSceneGroup>>(() => {
    if (!isSuccess || !task) return EMPTY_FRAME_MAP
    return new Map(task.frames.map((group) => [group.index, group]))
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
    framesByScene,
    frameCount: isSuccess && task ? task.frameCount : 0,
    canExtract: sceneTaskId !== '',
    extract,
  }
}
