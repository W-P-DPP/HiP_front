import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { SystemResources } from '@/types/system'
import { getSystemResources, systemQueryKeys } from '@/api/system'
import { formatClockTime } from '@/utils/format'

/** 系统资源轮询间隔（毫秒） */
const SYSTEM_RESOURCES_POLL_INTERVAL = 5_000

/** 趋势样本最多保留点数（5s 轮询，约 5 分钟窗口） */
const RESOURCE_HISTORY_MAX_POINTS = 60

/** 单次轮询的 GPU 利用率/温度快照（以 GPU name 为键） */
export interface GpuResourceSnapshot {
  utilizationPercent: number
  temperature: number
}

/** 单次轮询累计出的趋势样本（cpu/gpu 折线用） */
export interface SystemResourceSample {
  /** 采集时刻 HH:mm:ss */
  time: string
  /** CPU 使用率 % */
  cpu: number
  /** GPU name → 利用率/温度 */
  gpus: Record<string, GpuResourceSnapshot>
}

/** 轮询结果：当前全量快照 + 本地累计的滑动趋势 */
export interface SystemResourcesResult {
  /** 最近一次全量快照（内存/磁盘明细/进程/GPU 现状） */
  latest: SystemResources
  /** 滑动趋势样本（cpu/disk/gpu 折线数据源） */
  samples: SystemResourceSample[]
}

export function useSystemResources() {
  const queryClient = useQueryClient()
  // 组件卸载时 ref 一并销毁；重进页面用缓存中的旧趋势续接，避免图表闪断
  const samplesRef = useRef<SystemResourceSample[]>(
    queryClient.getQueryData<SystemResourcesResult>(systemQueryKeys.resources)?.samples ?? [],
  )

  return useQuery<SystemResourcesResult>({
    queryKey: systemQueryKeys.resources,
    queryFn: async () => {
      const latest = await getSystemResources()
      const next = [
        ...samplesRef.current.slice(-(RESOURCE_HISTORY_MAX_POINTS - 1)),
        {
          time: formatClockTime(new Date()),
          cpu: latest.cpu.usagePercent,
          gpus: Object.fromEntries(
            latest.gpu.map((g) => [
              g.name,
              {
                utilizationPercent: g.utilizationPercent,
                temperature: g.temperature,
              },
            ]),
          ),
        },
      ]
      samplesRef.current = next
      return { latest, samples: next }
    },
    refetchInterval: SYSTEM_RESOURCES_POLL_INTERVAL,
  })
}
