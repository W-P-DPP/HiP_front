import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** 单列配置 */
export interface DataTableColumn<T> {
  /** 列标识，同时作为默认取值字段 */
  key: string
  /** 表头文案 */
  title: ReactNode
  /** 单元格对齐方式，默认左对齐 */
  align?: 'left' | 'center' | 'right'
  /** 列宽 class（如 'w-32'），同时作用于表头与单元格 */
  width?: string
  /** 附加到表头与单元格的 class */
  className?: string
  /** 自定义单元格渲染；默认取 record[key]，null/undefined 渲染为空 */
  render?: (record: T, index: number) => ReactNode
}

/** 分页条配置 */
export interface DataTablePagination {
  page: number
  pageSize: number
  total: number
  /** 每页条数可选项，默认 [10, 20, 50, 100] */
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

/** 多选列配置：传入后在表格左侧渲染勾选列 */
export interface DataTableSelection<T> {
  /** 已选行的 rowKey 集合 */
  selectedKeys: ReadonlySet<string | number>
  /** 勾选 / 取消勾选单个行 */
  onToggleRow: (record: T) => void
  /** 勾选 / 取消勾选当前页全部；不传则不渲染表头全选框 */
  onToggleAll?: (records: T[]) => void
  /** 该行是否禁用勾选（禁用行不计入全选判断） */
  isRowDisabled?: (record: T) => boolean
  /** 勾选框的无障碍文案，如「序号 5」 */
  rowLabel?: (record: T) => string
}

/** 行展开配置：传入后每行左侧渲染展开箭头，展开时在行下方渲染子内容 */
export interface DataTableExpansion<T> {
  /** 已展开行的 rowKey 集合 */
  expandedKeys: ReadonlySet<string | number>
  /** 切换某行展开态 */
  onToggleRow: (record: T) => void
  /** 展开行内容 */
  renderExpanded: (record: T) => ReactNode
  /** 该行是否可展开，默认全部可展开；返回 false 的行不渲染展开箭头且不可展开 */
  isRowExpandable?: (record: T) => boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** 行的稳定唯一 key，禁止用数组 index */
  rowKey: (record: T) => string | number
  /** 首次加载：渲染骨架行 */
  loading?: boolean
  /** 翻页/刷新中：保留旧行并轻微降透明度 */
  fetching?: boolean
  error?: Error | null
  /** 加载失败时的重试回调（通常传 refetch） */
  onRetry?: () => void
  pagination?: DataTablePagination
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  /** 行点击回调（如点击整行勾选/取消选中） */
  onRowClick?: (record: T, index: number) => void
  /** 高亮行 key，命中时该行加 data-state="selected"（复用 table.tsx 既有选中样式） */
  activeRowKey?: string | number
  /** 多选配置：传入后左侧增加勾选列 */
  selection?: DataTableSelection<T>
  /** 行展开配置：传入后左侧增加展开列，展开时在行下方渲染子内容 */
  expansion?: DataTableExpansion<T>
  className?: string
}

const SKELETON_ROWS = 5
const DEFAULT_PAGE_SIZES = [10, 20, 50, 100] as const

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/** 默认取 record[key]，null/undefined 渲染为空字符串 */
function renderColumnValue<T>(
  record: T,
  column: DataTableColumn<T>,
  index: number,
): ReactNode {
  if (column.render) return column.render(record, index)
  const raw = (record as Record<string, unknown>)[column.key]
  return raw == null ? '' : String(raw)
}

function renderLoadingRows<T>(
  columns: readonly DataTableColumn<T>[],
  rowCount: number,
  hasSelection: boolean,
  hasExpansion: boolean,
): ReactNode {
  return Array.from({ length: rowCount }, (_, rowIndex) => (
    <TableRow key={rowIndex}>
      {hasExpansion ? (
        <TableCell className="w-10">
          <Skeleton className="size-4 rounded-[4px]" />
        </TableCell>
      ) : null}
      {hasSelection ? (
        <TableCell className="w-10">
          <Skeleton className="size-4 rounded-[4px]" />
        </TableCell>
      ) : null}
      {columns.map((column) => (
        <TableCell
          key={column.key}
          className={cn(ALIGN_CLASS[column.align ?? 'left'], column.width)}
        >
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

function renderEmptyRow(
  colSpan: number,
  title: ReactNode,
  description?: ReactNode,
): ReactNode {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-16 text-center">
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

function renderErrorRow(
  colSpan: number,
  message: ReactNode,
  onRetry?: () => void,
): ReactNode {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-destructive">{message}</span>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              重试
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

function renderPaginationBar(pagination: DataTablePagination): ReactNode {
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

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  fetching = false,
  error = null,
  onRetry,
  pagination,
  emptyTitle = '暂无数据',
  emptyDescription,
  onRowClick,
  activeRowKey,
  selection,
  expansion,
  className,
}: DataTableProps<T>) {
  const hasSelection = Boolean(selection)
  const hasExpansion = Boolean(expansion)
  const colSpan = columns.length + (hasSelection ? 1 : 0) + (hasExpansion ? 1 : 0)
  const skeletonRows = Math.min(pagination?.pageSize ?? SKELETON_ROWS, 10)
  const showPagination = Boolean(pagination && pagination.total > 0)

  // 表头全选框状态：禁用行不计入，避免存在禁用行时永远无法进入「全选」
  const selectableRecords = selection
    ? data.filter((record) => !selection.isRowDisabled?.(record))
    : []
  const selectedRowCount = selection
    ? selectableRecords.filter((record) => selection.selectedKeys.has(rowKey(record))).length
    : 0
  const isAllSelected =
    selectableRecords.length > 0 && selectedRowCount === selectableRecords.length
  const isPartiallySelected = selectedRowCount > 0 && !isAllSelected

  let bodyContent: ReactNode
  if (loading) {
    bodyContent = renderLoadingRows(columns, skeletonRows, hasSelection, hasExpansion)
  } else if (error && data.length === 0) {
    bodyContent = renderErrorRow(
      colSpan,
      error.message || '加载失败，请稍后重试',
      onRetry,
    )
  } else if (data.length === 0) {
    bodyContent = renderEmptyRow(colSpan, emptyTitle, emptyDescription)
  } else {
    bodyContent = data.map((record, rowIndex) => {
      const key = rowKey(record)
      const isActiveRow = activeRowKey !== undefined && key === activeRowKey
      // 选中行同样加 data-state="selected"：整行点击选中时，行背景是主要的选中反馈
      const isSelectedRow = selection?.selectedKeys.has(key) ?? false
      const isExpandable = expansion
        ? (expansion.isRowExpandable?.(record) ?? true)
        : false
      const isExpanded = isExpandable && (expansion?.expandedKeys.has(key) ?? false)
      return (
        <Fragment key={key}>
          <TableRow
            data-state={isActiveRow || isSelectedRow ? 'selected' : undefined}
            className={cn(onRowClick && 'cursor-pointer')}
            onClick={onRowClick ? () => onRowClick(record, rowIndex) : undefined}
          >
            {hasExpansion ? (
              <TableCell className="w-10">
                {isExpandable ? (
                  // 阻止冒泡：点展开箭头只切换展开态，避免再触发整行点击而来回切换
                  <div onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? '收起' : '展开'}
                      onClick={() => expansion?.onToggleRow(record)}
                    >
                      <ChevronRight
                        className={cn('transition-transform', isExpanded && 'rotate-90')}
                      />
                    </Button>
                  </div>
                ) : null}
              </TableCell>
            ) : null}
            {hasSelection ? (
              <TableCell className="w-10">
                {/* 阻止冒泡：点勾选框只切换本次勾选，避免再触发整行点击而来回切换 */}
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selection?.selectedKeys.has(key) ?? false}
                    disabled={selection?.isRowDisabled?.(record)}
                    aria-label={selection?.rowLabel?.(record) ?? '选择该行'}
                    onCheckedChange={() => selection?.onToggleRow(record)}
                  />
                </div>
              </TableCell>
            ) : null}
            {columns.map((column) => (
              <TableCell
                key={column.key}
                className={cn(
                  ALIGN_CLASS[column.align ?? 'left'],
                  column.width,
                  column.className,
                )}
              >
                {renderColumnValue(record, column, rowIndex)}
              </TableCell>
            ))}
          </TableRow>
          {isExpanded && expansion ? (
            <TableRow data-state="expanded">
              <TableCell colSpan={colSpan} className="bg-muted/30">
                {expansion.renderExpanded(record)}
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      )
    })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {hasExpansion ? <TableHead className="w-10" /> : null}
              {hasSelection ? (
                <TableHead className="w-10">
                  {selection?.onToggleAll ? (
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isPartiallySelected}
                      disabled={selectableRecords.length === 0}
                      aria-label="全选本页"
                      onCheckedChange={() => selection.onToggleAll?.(data)}
                    />
                  ) : null}
                </TableHead>
              ) : null}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    ALIGN_CLASS[column.align ?? 'left'],
                    column.width,
                    column.className,
                  )}
                >
                  {column.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={cn('transition-opacity', fetching && 'opacity-60')}>
            {bodyContent}
          </TableBody>
        </Table>
      </div>
      {showPagination && pagination ? renderPaginationBar(pagination) : null}
    </div>
  )
}
