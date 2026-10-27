import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  createSceneTranscribeTask,
  getSceneTranscribeTaskDetail,
  getSceneTranscribeTaskQueue,
  sceneTranscribeQueryKeys,
} from '@/api/scene-transcribe'
import {
  SYNTHESIS_QUEUE_POLL_INTERVAL,
  SYNTHESIS_TASK_POLL_INTERVAL,
} from '@/constant/poll'
import { isSceneTranscribeTaskFinished } from '@/types/scene-transcribe'
import type {
  SceneTranscribeSceneSegments,
  SceneTranscribeTask,
  SceneTranscribeTaskStatus,
} from '@/types/scene-transcribe'

/** 场景转写状态：idle 未提交，其余与后端任务状态一致 */
export type SceneTranscriptionStatus = 'idle' | SceneTranscribeTaskStatus

/** 已提交的任务快照：taskId 驱动轮询，sourceTaskId 用于判定来源场景任务是否已变更 */
interface ActiveTranscribeTask {
  taskId: string
  sourceTaskId: string
  /** 由记录跳转带入的初始任务：跳过排队阶段，直接拉取详情 */
  fromSeed: boolean
}

/** useSceneTranscription 入参 */
export interface UseSceneTranscriptionOptions {
  /** 来源场景切分任务 id；变化即视为上一轮转写结果失效。为空时不可提交 */
  sceneTaskId: string
  /** 从记录跳转带入的初始任务：sourceTaskId 需与当前来源一致，进入即拉取详情（含 sceneSegments） */
  seed?: { taskId: string; sourceTaskId: string }
}

/** 场景转写步骤的状态与动作（真实接口 + 两阶段轮询） */
export interface SceneTranscriptionController {
  /** 当前状态 */
  status: SceneTranscriptionStatus
  /** 是否正在处理（提交中 / 排队中 / 转写中） */
  isGenerating: boolean
  /** 排队位置，1 为队首；已出队执行或未提交时为 null */
  queuePosition: number | null
  /** 前方等待任务数 */
  waitingAhead: number
  /** 队列总深度 */
  queueDepth: number
  /** 转写进度 0..1 */
  progress: number
  /** 阶段中文描述 */
  stageLabel: string
  /** 失败原因 */
  errorMessage: string
  /** 任务详情（成功后含 sceneSegments）；未提交或结果失效时为 null */
  task: SceneTranscribeTask | null
  /** 按场景归组的文本分段，仅成功时非空 */
  sceneSegments: SceneTranscribeSceneSegments[]
  /** 文本分段总数，未成功时为 0 */
  segmentCount: number
  /** 是否可提交转写（来源场景任务已就绪） */
  canTranscribe: boolean
  /** 提交场景转写任务 */
  transcribe: () => void
}

const EMPTY_SCENE_SEGMENTS: SceneTranscribeSceneSegments[] = []

/**
 * 场景转写流程：以场景切分任务 id 提交转写任务、两阶段轮询进度
 * （都基于 TanStack Query，组件卸载时自动清除定时器）。
 *
 * 1. 排队位置 `GET /aiDetect/asr/tasks/:taskId/queue`（5s）：任务出队执行（position 为 null 且
 *    status 为 running）后停止；
 * 2. 任务状态 `GET /aiDetect/asr/tasks/:taskId`（10s）：出队后开始，进入终态后停止，成功后携带 sceneSegments。
 */
export function useSceneTranscription({
  sceneTaskId,
  seed,
}: UseSceneTranscriptionOptions): SceneTranscriptionController {
  // 携带记录跳转时以该任务为初始活动任务，进入即拉取详情（含 sceneSegments）
  const [active, setActive] = useState<ActiveTranscribeTask | null>(() =>
    seed ? { taskId: seed.taskId, sourceTaskId: seed.sourceTaskId, fromSeed: true } : null,
  )

  // 来源场景任务变更后旧转写任务失效：不再观察其轮询（taskId 置空 → 查询禁用、结果随之清空）。
  // 用派生判断代替 effect 重置，避免级联渲染。
  const isActiveMatch = active !== null && active.sourceTaskId === sceneTaskId
  const activeTaskId = isActiveMatch ? active.taskId : ''
  // 记录带入的任务已是观察对象（无排队阶段），跳过队列查询直接拉详情
  const isSeedActive = isActiveMatch && active.fromSeed

  // 阶段一 · 排队位置（记录带入的任务跳过）
  const queueQuery = useQuery({
    queryKey: sceneTranscribeQueryKeys.taskQueue(activeTaskId),
    queryFn: () => getSceneTranscribeTaskQueue(activeTaskId),
    enabled: activeTaskId !== '' && !isSeedActive,
    refetchInterval: (query) => {
      const queue = query.state.data
      if (!queue) return SYNTHESIS_QUEUE_POLL_INTERVAL
      if (isSceneTranscribeTaskFinished(queue.status)) return false
      if (queue.position === null && queue.status === 'running') return false
      return SYNTHESIS_QUEUE_POLL_INTERVAL
    },
  })

  const isRunning = queueQuery.data?.position === null && queueQuery.data?.status === 'running'
  const isQueueFinished = isSceneTranscribeTaskFinished(queueQuery.data?.status)

  // 阶段二 · 任务状态：记录带入或出队执行（或队列已直接返回终态）后开始
  const taskQuery = useQuery({
    queryKey: sceneTranscribeQueryKeys.taskDetail(activeTaskId),
    queryFn: () => getSceneTranscribeTaskDetail(activeTaskId),
    enabled: activeTaskId !== '' && (isSeedActive || isRunning || isQueueFinished),
    refetchInterval: (query) =>
      isSceneTranscribeTaskFinished(query.state.data?.status)
        ? false
        : SYNTHESIS_TASK_POLL_INTERVAL,
  })

  const task = taskQuery.data ?? null

  const createMutation = useMutation({
    mutationFn: () => createSceneTranscribeTask({ taskId: sceneTaskId }),
  })

  const status: SceneTranscriptionStatus = (() => {
    if (!isActiveMatch) return 'idle'
    if (task) return task.status
    if (isRunning) return 'running'
    // 记录带入：详情未就绪时按进行中展示，避免出现「排队中 · 第 - 位」的空态文案
    if (isSeedActive) return 'running'
    return queueQuery.data?.status ?? 'pending'
  })()

  const isGenerating =
    createMutation.isPending ||
    (isActiveMatch && status !== 'idle' && !isSceneTranscribeTaskFinished(status))

  const transcribe = useCallback(() => {
    if (createMutation.isPending || !sceneTaskId) return
    createMutation.mutate(undefined, {
      // 失败提示已由 axios 拦截器统一处理
      onSuccess: (accepted) =>
        setActive({ taskId: accepted.taskId, sourceTaskId: sceneTaskId, fromSeed: false }),
    })
  }, [sceneTaskId, createMutation])

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
    sceneSegments: isSuccess && task ? task.sceneSegments : EMPTY_SCENE_SEGMENTS,
    segmentCount: isSuccess && task ? task.segmentCount : 0,
    canTranscribe: sceneTaskId !== '',
    transcribe,
  }
}
