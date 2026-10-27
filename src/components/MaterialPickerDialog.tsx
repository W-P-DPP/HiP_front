import { AudioLines, ChevronLeft, ChevronRight, Clapperboard, Inbox, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { getMyVideoMaterials, videoMaterialQueryKeys } from '@/api/video-material'
import { AppDialog } from '@/components/AppDialog'
import { MediaPreview } from '@/components/MediaPreview'
import type { MediaPreviewType } from '@/components/MediaPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useVideoMaterialGroups } from '@/hooks/use-video-material-groups'
import { cn } from '@/lib/utils'
import type { VideoMaterial } from '@/types/video-material'
import { formatBytes, formatDateTime } from '@/utils/format'
import { resolveMaterialMediaType } from '@/utils/material'
import { message } from '@/utils/message'

/** 表格列数（选择框/预览/关键词/文件名/大小/时间），用于空态与骨架行 colspan */
const COLUMN_COUNT = 6

/** 首屏骨架行数 */
const SKELETON_ROWS = 5

/** 每页条数（弹框内不提供切换，保持轻量） */
const PAGE_SIZE = 10

export interface MaterialPickerDialogProps {
  /** 受控开关 */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 最多可选数量（视频工厂中 = 字幕条数 − 现有关键词数，即剩余可新增槽位） */
  maxCount: number
  /** 确认：按选择顺序回传所选素材 */
  onConfirm: (materials: VideoMaterial[]) => void
  /** 弹框标题，默认「选择素材」 */
  title?: ReactNode
  /** 可选说明文案 */
  description?: ReactNode
  /** 仅展示并允许选择该媒体类型（如 image）；不传时展示全部 */
  mediaType?: MediaPreviewType
}

/** 单行素材：整行可点击切换选中，预览与选择框各自阻止冒泡避免重复切换 */
function MaterialPickerRow({
  item,
  groupName,
  selected,
  onToggle,
}: {
  item: VideoMaterial
  groupName?: string
  selected: boolean
  onToggle: (item: VideoMaterial) => void
}) {
  const mediaType = resolveMaterialMediaType(item)
  const url = item.file?.url ?? ''
  const displayName = item.fileName || item.keyword

  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      className="cursor-pointer"
      onClick={() => onToggle(item)}
    >
      <TableCell className="w-10" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(item)}
          aria-label={`选择素材 ${displayName}`}
        />
      </TableCell>
      <TableCell className="w-20" onClick={(event) => event.stopPropagation()}>
        <MediaPreview src={url} type={mediaType} title={displayName}>
          <button
            type="button"
            className="block size-12 overflow-hidden rounded-lg bg-muted"
            aria-label={`预览 ${displayName}`}
          >
            {mediaType === 'image' ? (
              <img
                src={url}
                alt={item.keyword}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                {mediaType === 'video' ? (
                  <Clapperboard className="size-5 text-muted-foreground" />
                ) : (
                  <AudioLines className="size-5 text-muted-foreground" />
                )}
              </span>
            )}
          </button>
        </MediaPreview>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate">{item.keyword}</span>
          {groupName ? <Badge variant="secondary">{groupName}</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">{item.fileName}</TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {formatBytes(item.file?.size ?? 0)}
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {formatDateTime(item.createdAt)}
      </TableCell>
    </TableRow>
  )
}

/** 骨架行：列数与真实行一致，避免加载时布局跳动 */
function renderLoadingRows(): ReactNode {
  return Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: COLUMN_COUNT }, (_, cellIndex) => (
        <TableCell key={cellIndex}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

/** 空态行：大圆角 muted 图标 + 文案（对齐 DataTable 空态） */
function renderEmptyRow(title: ReactNode, description?: ReactNode): ReactNode {
  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center xl bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{title}</span>
            {description ? (
              <span className="text-sm text-muted-foreground">{description}</span>
            ) : null}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

/** 错误行：内联错误文案 + 重试 */
function renderErrorRow(error: Error, onRetry: () => void): ReactNode {
  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-destructive">{error.message || '加载失败，请稍后重试'}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * 素材选择弹框（公共组件）：表格展示当前用户素材库，按关键词服务端模糊查询，
 * 支持多选并限制上限（maxCount），确认后按选择顺序回传所选素材。
 */
export function MaterialPickerDialog({
  open,
  onOpenChange,
  maxCount,
  onConfirm,
  title = '选择素材',
  description,
  mediaType,
}: MaterialPickerDialogProps) {
  // 搜索：输入态 keywordInput + 应用态 keyword + 版本计数（条件未变也强制重新请求）
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchVersion, setSearchVersion] = useState(0)
  // 选中集合用 Map 保留完整对象与选择顺序，跨页/跨搜索保留
  const [selected, setSelected] = useState<Map<string, VideoMaterial>>(() => new Map())

  const { data, total, page, isLoading, isFetching, isError, error, refetch, setPage } =
    usePaginationQuery<VideoMaterial>({
      queryKey: [...videoMaterialQueryKeys.my, keyword, searchVersion],
      // 后端分页参数名是 limit，映射自 pageSize；无搜索条件不传 keyword
      queryFn: ({ page, pageSize }) =>
        getMyVideoMaterials({
          page,
          limit: pageSize,
          ...(keyword ? { keyword } : {}),
        }),
      enabled: open,
      initialPageSize: PAGE_SIZE,
    })

  const { groups } = useVideoMaterialGroups()
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group._id, group.name])),
    [groups],
  )

  // 客户端媒体类型过滤：素材列表接口无该过滤参数，按当前页可见类型过滤
  const visibleData = mediaType
    ? data.filter((item) => resolveMaterialMediaType(item) === mediaType)
    : data

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSelected(new Map())
        setKeywordInput('')
        setKeyword('')
        setPage(1)
      }
      onOpenChange(next)
    },
    [onOpenChange, setPage],
  )

  const handleSearch = useCallback(() => {
    setKeyword(keywordInput.trim())
    setPage(1)
    setSearchVersion((version) => version + 1)
  }, [keywordInput, setPage])

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') handleSearch()
    },
    [handleSearch],
  )

  const toggleItem = useCallback(
    (item: VideoMaterial) => {
      if (selected.has(item._id)) {
        setSelected((prev) => {
          const next = new Map(prev)
          next.delete(item._id)
          return next
        })
        return
      }
      if (selected.size >= maxCount) {
        message.warning(`最多只能选择 ${maxCount} 个素材`)
        return
      }
      setSelected((prev) => new Map(prev).set(item._id, item))
    },
    [selected, maxCount],
  )

  const allPageSelected =
    visibleData.length > 0 && visibleData.every((item) => selected.has(item._id))

  const toggleCurrentPage = useCallback(() => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Map(prev)
        visibleData.forEach((item) => next.delete(item._id))
        return next
      })
      return
    }
    const next = new Map(selected)
    let overflow = false
    for (const item of visibleData) {
      if (next.has(item._id)) continue
      if (next.size >= maxCount) {
        overflow = true
        break
      }
      next.set(item._id, item)
    }
    setSelected(next)
    if (overflow) message.warning(`最多只能选择 ${maxCount} 个素材`)
  }, [allPageSelected, selected, maxCount, visibleData])

  const showLoading = isLoading || (isFetching && data.length === 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  let bodyContent: ReactNode
  if (showLoading) {
    bodyContent = renderLoadingRows()
  } else if (isError && error && data.length === 0) {
    bodyContent = renderErrorRow(error, refetch)
  } else if (visibleData.length === 0) {
    if (data.length > 0) {
      // 当前页存在素材但均被媒体类型过滤掉
      bodyContent = renderEmptyRow('当前页无匹配素材', '试试翻页或搜索其他素材。')
    } else {
      bodyContent = keyword
        ? renderEmptyRow('未找到相关素材', '换个关键词试试。')
        : renderEmptyRow('暂无素材', '请先在素材库上传素材。')
    }
  } else {
    bodyContent = visibleData.map((item) => (
      <MaterialPickerRow
        key={item._id}
        item={item}
        groupName={item.groupId ? groupNameById.get(item.groupId) : undefined}
        selected={selected.has(item._id)}
        onToggle={toggleItem}
      />
    ))
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={
        description ?? `最多可选 ${maxCount} 个，已选 ${selected.size} 个。`
      }
      confirmText="确定"
      confirmDisabled={selected.size === 0}
      contentClassName="sm:max-w-3xl"
      onConfirm={() => {
        onConfirm(Array.from(selected.values()))
        handleOpenChange(false)
      }}
    >
      <div className="flex flex-col gap-4 px-1">
        <div className="flex items-center gap-2">
          <Input
            aria-label="搜索素材关键词"
            placeholder="搜索素材关键词"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-64"
          />
          <Button data-icon="inline-start" onClick={handleSearch}>
            <Search />
            搜索
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    disabled={visibleData.length === 0}
                    onCheckedChange={toggleCurrentPage}
                    aria-label="全选当前页"
                  />
                </TableHead>
                <TableHead className="w-20">预览</TableHead>
                <TableHead>关键词</TableHead>
                <TableHead>文件名</TableHead>
                <TableHead className="text-right">大小</TableHead>
                <TableHead>上传时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn('transition-opacity', isFetching && 'opacity-60')}>
              {bodyContent}
            </TableBody>
          </Table>
        </div>

        {total > 0 ? (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="上一页"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="下一页"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppDialog>
  )
}
