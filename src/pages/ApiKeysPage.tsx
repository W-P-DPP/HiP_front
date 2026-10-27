import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  apiKeyQueryKeys,
  createApiKey,
  deleteApiKey,
  getApiKeyList,
  updateApiKeyName,
} from '@/api/api-keys'
import { AppDialog } from '@/components/AppDialog'
import { ConfirmPopover } from '@/components/ConfirmPopover'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useUserStore } from '@/store/user'
import type { ApiKey, ApiKeyStatus } from '@/types/api-key'
import { formatDateTime } from '@/utils/format'

const STATUS_META: Record<
  ApiKeyStatus,
  { label: string; variant: 'secondary' | 'outline' }
> = {
  active: { label: '正常', variant: 'secondary' },
  disabled: { label: '已禁用', variant: 'outline' },
}

/** 组装表格列：操作列 render 需引用组件内的编辑/删除回调 */
function buildColumns(handlers: {
  onEdit: (row: ApiKey) => void
  onDelete: (id: string) => void
  deleting: boolean
}): DataTableColumn<ApiKey>[] {
  return [
    { key: 'name', title: '名称' },
    {
      key: 'uuid',
      title: '密钥',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <code className="min-w-0 max-w-60 truncate d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {row.uuid}
          </code>
          <CopyButton value={row.uuid} />
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => {
        const meta = STATUS_META[row.status]
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
    },
    {
      key: 'issuedAt',
      title: '创建时间',
      className: 'tabular-nums',
      render: (row) => formatDateTime(row.issuedAt),
    },
    {
      key: 'expireAt',
      title: '过期时间',
      className: 'tabular-nums',
      render: (row) => formatDateTime(row.expireAt),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="编辑"
            onClick={() => handlers.onEdit(row)}
          >
            <Pencil />
          </Button>
          <ConfirmPopover
            title="确认删除"
            description={`确认删除「${row.name}」？删除后不可恢复。`}
            confirmLoading={handlers.deleting}
            onConfirm={() => handlers.onDelete(row._id)}
          >
            <Trash2 />
          </ConfirmPopover>
        </div>
      ),
    },
  ]
}

export function ApiKeysPage() {
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // 搜索/重置点击计数：即使 keyword 未变化也强制重新请求
  const [searchVersion, setSearchVersion] = useState(0)
  const userId = useUserStore((state) => state.userId)

  // 新增/编辑弹框状态
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')

  const {
    data,
    total,
    page,
    pageSize,
    isLoading,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePaginationQuery<ApiKey>({
    queryKey: [...apiKeyQueryKeys.list, keyword, searchVersion],
    queryFn: ({ page, pageSize }) =>
      getApiKeyList({
        userId,
        page,
        limit: pageSize,
        ...(keyword ? { name: keyword } : {}), // 无关键词不传 name
      }),
    enabled: Boolean(userId), // userId 未就绪时不请求
  })

  const createMutation = useMutation({ mutationFn: createApiKey })
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateApiKeyName(id, name),
  })
  const deleteMutation = useMutation({ mutationFn: deleteApiKey })

  const handleCreate = useCallback(async () => {
    const name = createName.trim()
    if (!name || !userId) return
    try {
      await createMutation.mutateAsync({ userId, name })
      setCreateOpen(false)
      setCreateName('')
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [createName, userId, createMutation, refetch])

  const handleOpenEdit = useCallback((row: ApiKey) => {
    setEditId(row._id)
    setEditName(row.name)
    setEditOpen(true)
  }, [])

  const handleEdit = useCallback(async () => {
    const name = editName.trim()
    if (!name || !editId) return
    try {
      await updateMutation.mutateAsync({ id: editId, name })
      setEditOpen(false)
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [editName, editId, updateMutation, refetch])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        refetch()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [deleteMutation, refetch],
  )

  const columns = useMemo(
    () =>
      buildColumns({
        onEdit: handleOpenEdit,
        onDelete: handleDelete,
        deleting: deleteMutation.isPending,
      }),
    [handleOpenEdit, handleDelete, deleteMutation.isPending],
  )

  const handleSearch = () => {
    setKeyword(keywordInput.trim())
    setPage(1)
    // 计数自增使 queryKey 一定变化，无论 keyword 是否变更都重新请求
    setSearchVersion((v) => v + 1)
  }

  const handleReset = () => {
    setKeywordInput('')
    setKeyword('')
    setPage(1)
    setSearchVersion((v) => v + 1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && createName.trim() && !createMutation.isPending) {
      handleCreate()
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && editName.trim() && !updateMutation.isPending) {
      handleEdit()
    }
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索密钥名称"
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
        <Button data-icon="inline-start" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus />
          新增密钥
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row._id}
        loading={isLoading || !userId}
        error={error}
        onRetry={refetch}
        emptyTitle="暂无 API 密钥"
        emptyDescription="创建密钥后用于调用平台开放接口。"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      <AppDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setCreateName('') // 关闭时清空，避免下次打开残留
        }}
        title="新增密钥"
        description="创建后可在其他系统调用平台开放接口。"
        confirmLoading={createMutation.isPending}
        confirmDisabled={!createName.trim()}
        onConfirm={handleCreate}
      >
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Label htmlFor="create-key-name">名称</Label>
          <Input
            id="create-key-name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            onKeyDown={handleCreateKeyDown}
            placeholder="请输入密钥名称"
            autoFocus
          />
        </div>
      </AppDialog>

      <AppDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditId('')
            setEditName('')
          }
        }}
        title="编辑密钥"
        confirmLoading={updateMutation.isPending}
        confirmDisabled={!editName.trim()}
        onConfirm={handleEdit}
      >
        <div className="flex flex-col gap-1.5  px-2.5 py-1">
          <Label htmlFor="edit-key-name">名称</Label>
          <Input
            id="edit-key-name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="请输入密钥名称"
            autoFocus
          />
        </div>
      </AppDialog>
    </div>
  )
}
