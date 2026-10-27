import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchAllVoiceTrainResults,
  getAllVoiceTrainResults,
  getPublicVoiceTrainResults,
  getVoiceTrainResults,
  voiceTrainingQueryKeys,
} from '@/api/voice-training'
import { ROLE, usePermission } from '@/hooks/use-permission'
import type { Role } from '@/types/user'
import type { VoiceTrainResult } from '@/types/voice-training'

/** 角色→结果集：user 公共 / admin 管理+公共合并 / sadmin 全部 */
export interface UseVoiceTrainResultsResult {
  /** 当前用户角色；加载中为 undefined */
  role: Role | undefined
  /** 按角色可见、已去重并按创建时间倒序的全量结果 */
  rows: VoiceTrainResult[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  /** 当前行是否可编辑：sadmin 全部可编辑，admin 仅非公共记录可编辑，user 不可编辑 */
  canEdit: (row: VoiceTrainResult) => boolean
}

interface ResultsQueryData {
  rows: VoiceTrainResult[]
  /** admin 视角下公共结果集合，用于「公共记录不可编辑」判断 */
  publicIds: Set<string>
}

/** 结果按创建时间倒序，时间相同按 taskId 兜底，保证顺序稳定 */
function sortResults(rows: VoiceTrainResult[]): VoiceTrainResult[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.taskId.localeCompare(b.taskId),
    )
}

/** 基于当前用户角色拉取音色训练结果（角色未知时不发请求，避免暴露越权数据） */
export function useVoiceTrainResults(): UseVoiceTrainResultsResult {
  const { role, isLoading: roleLoading } = usePermission()

  const query = useQuery({
    queryKey: [...voiceTrainingQueryKeys.results, role],
    enabled: Boolean(role),
    queryFn: async (): Promise<ResultsQueryData> => {
      if (role === ROLE.USER) {
        const rows = await fetchAllVoiceTrainResults(getPublicVoiceTrainResults)
        return { rows: sortResults(rows), publicIds: new Set<string>() }
      }
      if (role === ROLE.SADMIN) {
        const rows = await fetchAllVoiceTrainResults(getAllVoiceTrainResults)
        return { rows: sortResults(rows), publicIds: new Set<string>() }
      }
      // admin：两个接口并行拉取，按 taskId（回退 trainId）并集去重
      const [mine, pub] = await Promise.all([
        fetchAllVoiceTrainResults(getVoiceTrainResults),
        fetchAllVoiceTrainResults(getPublicVoiceTrainResults),
      ])
      const publicIds = new Set(pub.map((result) => result.taskId))
      const byId = new Map<string, VoiceTrainResult>()
      for (const result of [...mine, ...pub]) {
        const key = result.taskId || result.trainId
        if (key && !byId.has(key)) byId.set(key, result)
      }
      return { rows: sortResults([...byId.values()]), publicIds }
    },
  })

  const rows = query.data?.rows ?? []

  const canEdit = useCallback(
    (row: VoiceTrainResult): boolean => {
      if (role === ROLE.SADMIN) return true
      if (role !== ROLE.ADMIN) return false
      // admin：公共记录不可编辑
      return !(query.data?.publicIds.has(row.taskId) ?? false)
    },
    [role, query.data],
  )

  return {
    role,
    rows,
    isLoading: roleLoading || query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    canEdit,
  }
}
