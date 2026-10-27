import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ImageOff,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

import { ConfirmPopover } from '@/components/ConfirmPopover'
import { MediaPreview } from '@/components/MediaPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { VideoMaterial } from '@/types/video-material'
import { formatBytes, formatDateTime } from '@/utils/format'
import { resolveMaterialMediaType } from '@/utils/material'

/** 分页条配置（与 DataTablePagination 同构，供 tab 直接把 usePaginationQuery 返回值传入） */
export interface MaterialPagination {
  page: number
  pageSize: number
  total: number
  /** 每页条数可选项，默认 [10, 20, 50, 100] */
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

/** 多选配置：传入后每张卡片左上角渲染勾选框，选中卡片加高亮环 */
export interface MaterialGridSelection {
  /** 已选素材 id 集合 */
  selectedKeys: ReadonlySet<string>
  /** 勾选 / 取消勾选单个素材 */
  onToggleRow: (item: VideoMaterial) => void
}

export interface MaterialGridProps {
  data: VideoMaterial[]
  /** 首次加载：渲染骨架网格 */
  loading?: boolean
  /** 翻页/刷新中：保留旧数据并轻微降透明度 */
  fetching?: boolean
  error?: Error | null
  /** 加载失败时的重试回调（通常传 refetch） */
  onRetry?: () => void
  pagination?: MaterialPagination
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  /** 分组 id → 分组名映射，用于在卡片上展示所属分组徽标 */
  groupNames?: ReadonlyMap<string, string>
  /** 提供后每个缩略图右上角悬浮显示编辑按钮（tab1 传，tab2 只读不传） */
  onEdit?: (item: VideoMaterial) => void
  /** 提供后每个缩略图右上角悬浮显示删除按钮（tab1 传，tab2 只读不传） */
  onDelete?: (item: VideoMaterial) => void | Promise<void>
  /** 多选配置：传入后每张卡片左上角显示勾选框（tab1 传，tab2 只读不传） */
  selection?: MaterialGridSelection
  className?: string
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100] as const

/** 单个素材缩略图 tile：图片显示封面，视频/音频显示图标占位；整块可点击打开预览 */
function MaterialCard({
  item,
  groupNames,
  onEdit,
  onDelete,
  selection,
}: {
  item: VideoMaterial
  groupNames?: ReadonlyMap<string, string>
  onEdit?: (item: VideoMaterial) => void
  onDelete?: (item: VideoMaterial) => void | Promise<void>
  selection?: MaterialGridSelection
}) {
  const mediaType = resolveMaterialMediaType(item)
  const url = item.file?.url ?? ''
  const groupName = item.groupId ? groupNames?.get(item.groupId) : undefined
  const selected = selection?.selectedKeys.has(item._id) ?? false
  const [deleting, setDeleting] = useState(false)

  // ConfirmPopover 的 onConfirm 内部 await 后关闭，onDelete 需自行捕获错误避免未处理拒绝
  const handleConfirmDelete = useCallback(async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(item)
    } finally {
      setDeleting(false)
    }
  }, [onDelete, item])

  return (
    <MediaPreview src={url} type={mediaType} title={item.fileName || item.keyword}>
      <div className="group/tile flex cursor-pointer flex-col gap-2">
        <div className="relative">
          {mediaType === 'image' ? (
            <div
              className={cn(
                'aspect-square w-full overflow-hidden rounded-xl bg-muted',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            >
              <img
                src={url}
                alt={item.keyword}
                loading="lazy"
                className="size-full object-cover transition-transform duration-200 group-hover/tile:scale-[1.02]"
              />
            </div>
          ) : (
            <div
              className={cn(
                'flex aspect-square w-full items-center justify-center rounded-xl bg-muted',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            >
              {mediaType === 'video' ? (
                <Clapperboard className="size-10 text-muted-foreground" />
              ) : (
                <AudioLines className="size-10 text-muted-foreground" />
              )}
            </div>
          )}
          {selection ? (
            // 勾选框常驻左上角；stopPropagation 避免点击冒泡到外层 MediaPreview 触发器
            <div className="absolute left-2 top-2 z-10" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => selection.onToggleRow(item)}
                aria-label={`选择素材 ${item.keyword}`}
                className="border-background bg-background/80 shadow-sm backdrop-blur"
              />
            </div>
          ) : null}
          {onEdit || onDelete ? (
            // stopPropagation 阻止点击冒泡到外层 MediaPreview 触发器，避免误开预览
            <div
              className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-background/80 shadow-sm backdrop-blur"
                  aria-label="编辑关键词"
                  onClick={() => onEdit(item)}
                >
                  <Pencil />
                </Button>
              ) : null}
              {onDelete ? (
                <div className="rounded-full bg-background/80 shadow-sm backdrop-blur">
                  <ConfirmPopover
                    title="删除素材"
                    description={`确定删除「${item.fileName || item.keyword}」？`}
                    confirmText="删除"
                    confirmLoading={deleting}
                    onConfirm={handleConfirmDelete}
                  >
                    <Trash2 />
                  </ConfirmPopover>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">{item.keyword}</span>
          {groupName ? (
            <Badge variant="secondary" className="self-start">
              {groupName}
            </Badge>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{item.fileName}</span>
            <span className="shrink-0 tabular-nums">{formatBytes(item.file?.size ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatDateTime(item.createdAt)}</span>
            {item.hitCount > 0 ? (
              <span className="shrink-0 tabular-nums">{item.hitCount} 次浏览</span>
            ) : null}
          </div>
        </div>
      </div>
    </MediaPreview>
  )
}

/** 首屏骨架网格，尺寸与真实 tile 一致避免布局跳动 */
function MaterialSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

/** 空态：大圆角 muted 底 + 图标 + 文案（仿 DataTable 空态） */
function MaterialEmptyState({
  title,
  description,
}: {
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-muted py-16">
      <div className="flex size-12 items-center justify-center xl bg-background">
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="text-sm text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </div>
  )
}

function MaterialErrorState({ message, onRetry }: { message: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-muted py-16">
      <span className="text-sm text-destructive">{message}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  )
}

/** 分页条：左侧「共 N 条」+ 每页条数选择，右侧上一页/下一页（样式对齐 DataTable） */
function MaterialPaginationBar({ pagination }: { pagination: MaterialPagination }) {
  const { page, pageSize, total, onPageChange, onPageSizeChange } = pagination
  const pageSizeOptions = pagination.pageSizeOptions ?? DEFAULT_PAGE_SIZES
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>共 {total} 条</span>
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / 页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="上一页"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center text-sm text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="下一页"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function MaterialGrid({
  data,
  loading = false,
  fetching = false,
  error = null,
  onRetry,
  pagination,
  emptyTitle = '暂无素材',
  emptyDescription,
  groupNames,
  onEdit,
  onDelete,
  selection,
  className,
}: MaterialGridProps) {
  const skeletonCount = Math.min(pagination?.pageSize ?? 10, 10)
  const showPagination = Boolean(pagination && pagination.total > 0)

  let bodyContent: ReactNode
  if (loading) {
    bodyContent = <MaterialSkeletonGrid count={skeletonCount} />
  } else if (error && data.length === 0) {
    bodyContent = (
      <MaterialErrorState message={error.message || '加载失败，请稍后重试'} onRetry={onRetry} />
    )
  } else if (data.length === 0) {
    bodyContent = <MaterialEmptyState title={emptyTitle} description={emptyDescription} />
  } else {
    bodyContent = (
      <div
        className={cn(
          'grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
          fetching && 'opacity-60',
        )}
      >
        {data.map((item) => (
          <MaterialCard
            key={item._id}
            item={item}
            groupNames={groupNames}
            onEdit={onEdit}
            onDelete={onDelete}
            selection={selection}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {bodyContent}
      {showPagination && pagination ? <MaterialPaginationBar pagination={pagination} /> : null}
    </div>
  )
}
