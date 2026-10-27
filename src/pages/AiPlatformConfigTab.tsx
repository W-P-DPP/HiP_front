import { Eye, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  aiPlatformQueryKeys,
  deleteAiPlatform,
  getAiPlatformDetail,
  getAiPlatformList,
  getAiPlatformProviders,
} from '@/api/ai-platforms'
import { AiPlatformDialog } from '@/components/AiPlatformDialog'
import { ConfirmPopover } from '@/components/ConfirmPopover'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { DetailDialog } from '@/components/DetailDialog'
import type { DetailField } from '@/components/DetailDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type { AiPlatform, AiPlatformStatus } from '@/types/ai-platform'
import { formatDateTime, maskSecret } from '@/utils/format'

/** 状态展示：与后端 status 字段对应 */
const STATUS_META: Record<
  AiPlatformStatus,
  { label: string; variant: 'secondary' | 'outline' }
> = {
  active: { label: '正常', variant: 'secondary' },
  disabled: { label: '已禁用', variant: 'outline' },
}

/** 平台标识 → 展示名；平台列表未就绪时回退标识本身 */
type ProviderLabelOf = (key: string) => string

/** 组装表格列：操作列 render 需引用组件内的回调 */
function buildColumns(handlers: {
  providerLabelOf: ProviderLabelOf
  onDetail: (row: AiPlatform) => void
  onEdit: (row: AiPlatform) => void
  onDelete: (id: string) => void
  deleting: boolean
}): DataTableColumn<AiPlatform>[] {
  return [
    { key: 'name', title: '名称' },
    {
      key: 'provider',
      title: '平台',
      render: (row) => handlers.providerLabelOf(row.provider),
    },
    {
      key: 'defaultModel',
      title: '默认模型',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.defaultModel}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => {
        const meta = STATUS_META[row.status] ?? STATUS_META.disabled
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="查看详情"
            onClick={() => handlers.onDetail(row)}
          >
            <Eye />
          </Button>
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

/** 组装详情字段：apiKey 脱敏展示，复制按钮仍复制完整密钥 */
function buildDetailFields(
  platform: AiPlatform,
  providerLabelOf: ProviderLabelOf,
): DetailField[] {
  const statusMeta = STATUS_META[platform.status] ?? STATUS_META.disabled
  return [
    { id: 'name', label: '名称', value: platform.name },
    { id: 'provider', label: '平台', value: providerLabelOf(platform.provider) },
    { id: 'defaultModel', label: '默认模型', value: platform.defaultModel },
    {
      id: 'status',
      label: '状态',
      value: <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>,
    },
    {
      id: 'baseUrl',
      label: '基础地址',
      wide: true,
      value: platform.baseUrl || '—',
    },
    {
      id: 'apiKey',
      label: 'API Key',
      wide: true,
      value: (
        <div className="flex items-center gap-1.5">
          <code className="d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {maskSecret(platform.apiKey)}
          </code>
          <CopyButton value={platform.apiKey} />
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: '创建时间',
      value: formatDateTime(platform.createdAt),
    },
    {
      id: 'updatedAt',
      label: '更新时间',
      value: formatDateTime(platform.updatedAt),
    },
  ]
}

/** AI 平台配置 tab 内容：列表（名称模糊搜索）+ 新增/编辑/详情/删除 */
export function AiPlatformConfigTab() {
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // 搜索/重置点击计数：即使 keyword 未变化也强制重新请求
  const [searchVersion, setSearchVersion] = useState(0)

  // 弹框打开计数：作为弹框 key，保证每次打开都以最新数据重新初始化表单
  const [formSession, setFormSession] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<AiPlatform | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // 平台列表：用于表格「平台」列展示名，同时作为弹框下拉选项（同 key 缓存共享）
  const { data: providersData } = useQuery({
    queryKey: aiPlatformQueryKeys.providers,
    queryFn: getAiPlatformProviders,
    staleTime: 5 * 60_000,
  })

  const providerLabelOf = useCallback<ProviderLabelOf>(
    (key) =>
      providersData?.list.find((item) => item.key === key)?.label ?? key,
    [providersData],
  )

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
  } = usePaginationQuery<AiPlatform>({
    queryKey: [...aiPlatformQueryKeys.list, keyword, searchVersion],
    queryFn: ({ page: currentPage, pageSize: currentPageSize }) =>
      getAiPlatformList({
        page: currentPage,
        limit: currentPageSize,
        ...(keyword ? { name: keyword } : {}), // 无关键词不传 name
      }),
  })

  // 详情：仅在选中某行时请求
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: aiPlatformQueryKeys.detail(detailId ?? ''),
    queryFn: () => {
      if (!detailId) throw new Error('缺少配置 ID')
      return getAiPlatformDetail(detailId)
    },
    enabled: Boolean(detailId),
  })

  const deleteMutation = useMutation({ mutationFn: deleteAiPlatform })

  const handleOpenCreate = useCallback(() => {
    setFormSession((session) => session + 1)
    setCreateOpen(true)
  }, [])

  const handleOpenEdit = useCallback((row: AiPlatform) => {
    setFormSession((session) => session + 1)
    setEditRow(row)
  }, [])

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
        providerLabelOf,
        onDetail: (row) => setDetailId(row._id),
        onEdit: handleOpenEdit,
        onDelete: handleDelete,
        deleting: deleteMutation.isPending,
      }),
    [providerLabelOf, handleOpenEdit, handleDelete, deleteMutation.isPending],
  )

  const detailFields = useMemo(
    () => (detail ? buildDetailFields(detail, providerLabelOf) : []),
    [detail, providerLabelOf],
  )

  const handleSearch = () => {
    setKeyword(keywordInput.trim())
    setPage(1)
    // 计数自增使 queryKey 一定变化，无论 keyword 是否变更都重新请求
    setSearchVersion((version) => version + 1)
  }

  const handleReset = () => {
    setKeywordInput('')
    setKeyword('')
    setPage(1)
    setSearchVersion((version) => version + 1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索配置名称"
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
          <Button
            data-icon="inline-start"
            className="ml-auto"
            onClick={handleOpenCreate}
          >
            <Plus />
            新增平台
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => row._id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="暂无 AI 平台配置"
          emptyDescription="新增平台后可在此统一管理密钥与默认模型。"
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
        />
      </div>

      {/* 新增与编辑共用同一弹框；key 变更时重新挂载，用传入数据重新初始化表单 */}
      <AiPlatformDialog
        key={`ai-platform-create-${formSession}`}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refetch}
      />
      <AiPlatformDialog
        key={`ai-platform-edit-${formSession}`}
        open={Boolean(editRow)}
        onOpenChange={(open) => {
          if (!open) setEditRow(null)
        }}
        platform={editRow}
        onSuccess={refetch}
      />

      <DetailDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        title="AI 平台配置详情"
        description={detail?.name}
        loading={isDetailLoading}
        error={detailError}
        fields={detailFields}
      />
    </>
  )
}
