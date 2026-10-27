import { Pencil, Play, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  deleteDigitalHumanAvatar,
  digitalHumanQueryKeys,
  getDigitalHumanAvatarList,
  updateDigitalHumanAvatarName,
} from '@/api/digital-human'
import { AppDialog } from '@/components/AppDialog'
import { ConfirmPopover } from '@/components/ConfirmPopover'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { DigitalHumanAvatarDialog } from '@/components/DigitalHumanAvatarDialog'
import { MediaPreview } from '@/components/MediaPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useUserStore } from '@/store/user'
import type { DigitalHumanAvatar } from '@/types/digital-human'
import { formatBytes, formatDateTime, formatDuration } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

/** 组装表格列：操作列 render 需引用组件内的编辑/删除回调 */
function buildColumns(handlers: {
  onEdit: (row: DigitalHumanAvatar) => void
  onDelete: (id: string) => void
  deleting: boolean
}): DataTableColumn<DigitalHumanAvatar>[] {
  return [
    {
      key: 'name',
      title: '数字人名称',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'id',
      title: 'ID',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <code className="min-w-0 max-w-56 truncate d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {row.id}
          </code>
          <CopyButton value={row.id} />
        </div>
      ),
    },
    {
      key: 'sourceOriginalName',
      title: '原始文件',
      width: 'max-w-56',
      render: (row) => (
        <span className="block truncate text-muted-foreground">
          {row.sourceOriginalName || '--'}
        </span>
      ),
    },
    {
      key: 'sourceDuration',
      title: '时长',
      className: 'tabular-nums',
      render: (row) => formatDuration(row.sourceDuration),
    },
    {
      key: 'sourceSize',
      title: '大小',
      className: 'tabular-nums',
      render: (row) => formatBytes(row.sourceSize),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      className: 'tabular-nums',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <MediaPreview
            src={resolveMediaUrl(row.referenceUrl)}
            type="video"
            title={`${row.name} · 参考视频`}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="预览"
              disabled={!row.referenceUrl}
            >
              <Play />
            </Button>
          </MediaPreview>
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
            description={`确认删除数字人「${row.name}」？删除后不可恢复。`}
            confirmLoading={handlers.deleting}
            onConfirm={() => handlers.onDelete(row.id)}
          >
            <Trash2 />
          </ConfirmPopover>
        </div>
      ),
    },
  ]
}

export function DigitalHuman() {
  const userId = useUserStore((state) => state.userId)

  // 搜索：输入态 / 应用态分离，点搜索才生效；版本号保证同词重复搜索也重新请求
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchVersion, setSearchVersion] = useState(0)

  // 创建弹框开关（表单状态由 DigitalHumanAvatarDialog 自持）
  const [createOpen, setCreateOpen] = useState(false)

  // 编辑（改名）弹框状态
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
  } = usePaginationQuery<DigitalHumanAvatar>({
    queryKey: [...digitalHumanQueryKeys.avatars, keyword, searchVersion],
    queryFn: ({ page: pageNum, pageSize: size }) =>
      getDigitalHumanAvatarList({
        userId,
        page: pageNum,
        limit: size,
        ...(keyword ? { name: keyword } : {}), // 无关键词不传，走全量
      }),
    enabled: Boolean(userId), // userId 未就绪时不请求
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateDigitalHumanAvatarName(id, name),
  })
  const deleteMutation = useMutation({ mutationFn: deleteDigitalHumanAvatar })

  const handleOpenEdit = useCallback((row: DigitalHumanAvatar) => {
    setEditId(row.id)
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
    setSearchVersion((version) => version + 1)
  }

  const handleReset = () => {
    setKeywordInput('')
    setKeyword('')
    setPage(1)
    setSearchVersion((version) => version + 1)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
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
          placeholder="搜索数字人名称"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
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
        <Button
          data-icon="inline-start"
          className="ml-auto"
          onClick={() => setCreateOpen(true)}
        >
          <Plus />
          创建数字人
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        loading={isLoading || !userId}
        error={error}
        onRetry={refetch}
        emptyTitle="暂无数字人"
        emptyDescription="上传一段不少于 5 秒的视频，即可创建数字人。"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      <DigitalHumanAvatarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        userId={userId}
        onCreated={refetch}
      />

      <AppDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditId('')
            setEditName('')
          }
        }}
        title="编辑数字人"
        description="仅允许修改数字人名称。"
        confirmText="保存"
        confirmLoading={updateMutation.isPending}
        confirmDisabled={!editName.trim()}
        onConfirm={handleEdit}
      >
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Label htmlFor="edit-avatar-name">数字人名称</Label>
          <Input
            id="edit-avatar-name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="请输入数字人名称"
            autoFocus
          />
        </div>
      </AppDialog>
    </div>
  )
}
