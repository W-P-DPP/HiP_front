import { Pencil, Plus, RotateCcw, Search } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { updateVoiceTrainResult } from '@/api/voice-training'
import { AppDialog } from '@/components/AppDialog'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVoiceTrainResults } from '@/hooks/use-voice-train-results'
import { ROLE } from '@/hooks/use-permission'
import type { VoiceTrainResult } from '@/types/voice-training'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

/** trainStatus 数字 → 展示文案/徽章样式；未命中映射时兜底展示原始数字 */
const TRAIN_STATUS_META: Record<
  number,
  { label: string; variant: 'secondary' | 'outline' | 'destructive' }
> = {
  0: { label: '训练中', variant: 'secondary' },
  1: { label: '成功', variant: 'outline' },
  2: { label: '失败', variant: 'destructive' },
}

/** 音色 ID：assetId 优先，回退 trainVcn */
function resolveVoiceId(row: VoiceTrainResult): string {
  return row.assetId || row.trainVcn
}

/** 组装表格列：user 无「操作」列；admin 的公共记录编辑按钮置灰 */
function buildColumns(params: {
  showActions: boolean
  canEdit: (row: VoiceTrainResult) => boolean
  onEdit: (row: VoiceTrainResult) => void
}): DataTableColumn<VoiceTrainResult>[] {
  const columns: DataTableColumn<VoiceTrainResult>[] = [
    {
      key: 'resourceName',
      title: '名称',
      render: (row) => row.resourceName || '--',
    },
    {
      key: 'voiceId',
      title: '音色 ID',
      render: (row) => {
        const voiceId = resolveVoiceId(row)
        if (!voiceId) return '--'
        return (
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 max-w-60 truncate d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {voiceId}
            </code>
            <CopyButton value={voiceId} />
          </div>
        )
      },
    },
    {
      key: 'trainStatus',
      title: '状态',
      align: 'center',
      render: (row) => {
        const meta = TRAIN_STATUS_META[row.trainStatus]
        return (
          <Badge variant={meta?.variant ?? 'secondary'}>
            {meta?.label ?? `状态 ${row.trainStatus}`}
          </Badge>
        )
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      className: 'tabular-nums',
      render: (row) => formatDateTime(row.createdAt),
    },
  ]

  if (!params.showActions) return columns

  columns.push({
    key: 'actions',
    title: '操作',
    align: 'right',
    render: (row) => {
      const editable = params.canEdit(row)
      return (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!editable}
            title={editable ? undefined : '公共音色不可编辑'}
            aria-label="编辑"
            onClick={() => params.onEdit(row)}
          >
            <Pencil />
          </Button>
        </div>
      )
    },
  })

  return columns
}

export function VoiceTrainingPage() {
  const navigate = useNavigate()
  const { role, rows, isLoading, isError, error, refetch, canEdit } =
    useVoiceTrainResults()

  // 搜索应用态（触发搜索后才更新）
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')

  // 前端分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 编辑弹框状态（仅允许修改名称 resourceName）
  const [editOpen, setEditOpen] = useState(false)
  const [editTaskId, setEditTaskId] = useState('')
  const [editName, setEditName] = useState('')

  const updateMutation = useMutation({ mutationFn: updateVoiceTrainResult })

  /** 前端过滤：名称或音色 ID 命中关键词 */
  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      (row) =>
        row.resourceName.toLowerCase().includes(query) ||
        resolveVoiceId(row).toLowerCase().includes(query),
    )
  }, [rows, keyword])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  // 管理角色（admin / sadmin）：展示操作列，且可新增音色
  const isManager = role === ROLE.ADMIN || role === ROLE.SADMIN
  const showActions = isManager

  const handleOpenEdit = useCallback((row: VoiceTrainResult) => {
    setEditTaskId(row.taskId)
    setEditName(row.resourceName)
    setEditOpen(true)
  }, [])

  const handleEdit = useCallback(async () => {
    const name = editName.trim()
    if (!name || !editTaskId) return
    try {
      await updateMutation.mutateAsync({ taskId: editTaskId, resourceName: name })
      setEditOpen(false)
      refetch()
    } catch {
      // 失败提示由 axios 拦截器统一处理
    }
  }, [editName, editTaskId, updateMutation, refetch])

  const columns = useMemo(
    () => buildColumns({ showActions, canEdit, onEdit: handleOpenEdit }),
    [showActions, canEdit, handleOpenEdit],
  )

  const handleSearch = () => {
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  const handleReset = () => {
    setKeywordInput('')
    setKeyword('')
    setPage(1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && editName.trim() && !updateMutation.isPending) {
      void handleEdit()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索名称 / 音色ID"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={handleKeyDown}
          className="w-64"
        />
        <Button data-icon="inline-start" onClick={handleSearch}>
          <Search />
          搜索
        </Button>
        <Button variant="ghost" data-icon="inline-start" onClick={handleReset}>
          <RotateCcw />
          重置
        </Button>
        {isManager && (
          <Button
            data-icon="inline-start"
            className="ml-auto"
            onClick={() => navigate('/voice-training/create')}
          >
            <Plus />
            新增音色
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        rowKey={(row) => row.taskId}
        loading={isLoading}
        error={isError ? error : null}
        onRetry={refetch}
        emptyTitle="暂无音色结果"
        emptyDescription="训练完成后，此处按你的角色展示对应的音色结果。"
        pagination={{
          page: safePage,
          pageSize,
          total,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size)
            setPage(1)
          },
        }}
      />

      <AppDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditTaskId('')
            setEditName('')
          }
        }}
        title="编辑音色"
        description="仅允许修改音色名称。"
        confirmLoading={updateMutation.isPending}
        confirmDisabled={!editName.trim()}
        onConfirm={() => void handleEdit()}
      >
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Label htmlFor="edit-result-name">名称</Label>
          <Input
            id="edit-result-name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="请输入音色名称"
            autoFocus
          />
        </div>
      </AppDialog>
    </div>
  )
}
