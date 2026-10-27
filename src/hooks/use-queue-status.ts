import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import type { QueueStatus } from '@/types/api'
import { formatClockTime } from '@/utils/format'

/** 队列状态轮询间隔（毫秒） */
const QUEUE_POLL_INTERVAL = 10_000

/** 队列历史最多保留点数（10s 轮询，约 5 分钟窗口） */
const QUEUE_HISTORY_MAX_POINTS = 30

/** 队列趋势点 */
export interface QueueStatusPoint {
  /** 采集时刻 HH:mm:ss */
  time: string
  /** 等待中任务数 */
  pending: number
  /** 运行中任务数 */
  running: number
  /** 总任务数 */
  total: number
}

/**
 * 通用队列计数轮询：每 10s 拉取一次，把 pending/running/total 累积成折线趋势。
 * 组件卸载（无 observer）时由 react-query 自动清除 refetchInterval。
 * fetcher 需为模块级稳定引用（如 @/api/* 导出的请求函数），避免 queryFn 频繁重建。
 */
export function useQueueStatusTrend(
  queryKey: QueryKey,
  fetcher: () => Promise<QueueStatus>,
) {
  const queryClient = useQueryClient()
  // 组件卸载时 ref 一并销毁；重进页面用缓存中的旧趋势续接，避免图表闪断
  const historyRef = useRef<QueueStatusPoint[]>(
    queryClient.getQueryData<QueueStatusPoint[]>(queryKey) ?? [],
  )

  return useQuery<QueueStatusPoint[]>({
    queryKey,
    queryFn: async () => {
      const status = await fetcher()
      const next = [
        ...historyRef.current.slice(-(QUEUE_HISTORY_MAX_POINTS - 1)),
        {
          time: formatClockTime(new Date()),
          pending: status.pending,
          running: status.running,
          total: status.total,
        },
      ]
      historyRef.current = next
      return next
    },
    refetchInterval: QUEUE_POLL_INTERVAL,
  })
}
