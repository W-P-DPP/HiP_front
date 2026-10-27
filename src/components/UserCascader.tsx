import { useMemo, useState } from 'react'
import { ChevronRight, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { UserTreeNode } from '@/types/user'
import { cn } from '@/lib/utils'

interface UserCascaderProps {
  /** 用户树根节点（GET /users/children 的 data.list），逐级向下展开 */
  roots: readonly UserTreeNode[]
  /** 当前选中用户 id */
  value: string | null
  /** 选中某一级用户（含中间层）时回调 */
  onValueChange: (userId: string) => void
  /** 拉取用户树中：触发器禁用并提示加载 */
  loading?: boolean
  disabled?: boolean
  /** 无选择时的占位文案 */
  placeholder?: string
  /** roots 为空时的展示文案（此时不可选） */
  emptyText?: string
  /** 触发器宽度等 */
  className?: string
}

/** 用户行展示名：优先账号，缺省回退昵称（与用户管理列表首列一致） */
function displayName(node: UserTreeNode): string {
  return node.account || node.nickname
}

/** DFS 由 id 找从根到目标节点的路径；未命中返回 null */
function findPathById(
  roots: readonly UserTreeNode[],
  targetId: string,
  trail: UserTreeNode[] = [],
): UserTreeNode[] | null {
  for (const node of roots) {
    const path = [...trail, node]
    if (node.id === targetId) return path
    if (node.children.length > 0) {
      const found = findPathById(node.children, targetId, path)
      if (found) return found
    }
  }
  return null
}

/**
 * 用户层级「级联下拉选择器」（antd Cascader 风格，Base UI Popover 自建）：
 * 面板按 hover 链逐级联动出右侧子列，点击任意一级即选中该用户并关闭；
 * 触发器只显示选中用户本身的账号名（不带上级路径）。可复用于「选择层级用户」的筛选场景。
 */
export function UserCascader({
  roots,
  value,
  onValueChange,
  loading = false,
  disabled = false,
  placeholder = '请选择用户',
  emptyText = '暂无下级用户',
  className,
}: UserCascaderProps) {
  const [open, setOpen] = useState(false)
  // 面板内 hover 链（chain[0] ∈ roots，逐层下钻到当前聚焦节点）
  const [chain, setChain] = useState<UserTreeNode[]>([])

  const pickable = !loading && !disabled && roots.length > 0

  // 已选节点（取路径末级 = 选中的那个用户）；触发器只显示该用户名，不带上级路径
  const selectedPath = useMemo(
    () => (value ? findPathById(roots, value) ?? null : null),
    [roots, value],
  )
  const selectedLabel = selectedPath
    ? displayName(selectedPath[selectedPath.length - 1])
    : ''

  // 各列数据：第 0 列 = 根列表；之后每列 = 上一级 hover 节点的 children
  const columns = useMemo(() => {
    const cols: UserTreeNode[][] = []
    if (roots.length > 0) cols.push([...roots])
    for (const parent of chain) {
      if (parent.children.length > 0) cols.push(parent.children)
      else break
    }
    return cols
  }, [roots, chain])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setChain([])
  }

  /** hover 某一行：截断当前 hover 链到该列，再追加本节点（联动右侧子列） */
  const handleHover = (colIndex: number, node: UserTreeNode) => {
    setChain((prev) => [...prev.slice(0, colIndex), node])
  }

  const handleSelect = (node: UserTreeNode) => {
    onValueChange(node.id)
    setOpen(false)
  }

  const triggerText = selectedLabel || placeholder
  // 不可选（加载中/禁用/无数据）时的展示：已有选择显示选中项，否则给加载/空态文案
  const idleText = loading ? '加载中…' : selectedLabel || emptyText
  const triggerCls = cn(
    'h-8 w-48 justify-between gap-2 px-2.5',
    !selectedLabel && 'text-muted-foreground',
    className,
  )

  if (!pickable) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        aria-disabled="true"
        className={triggerCls}
      >
        <span className="truncate">{idleText}</span>
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={triggerCls}
          />
        }
      >
        <span className="min-w-0 flex-1 truncate" title={selectedLabel || placeholder}>
          {triggerText}
        </span>
        <ChevronsUpDown />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto flex-row gap-0 p-0">
        {columns.map((column, colIndex) => (
          <div
            key={colIndex}
            role="listbox"
            aria-label="选择用户"
            className="max-h-72 w-44 overflow-y-auto border-l border-border py-1 first:border-l-0"
          >
            {column.map((node) => {
              const active = chain[colIndex]?.id === node.id
              const hasChildren = node.children.length > 0
              return (
                <button
                  key={node.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => handleHover(colIndex, node)}
                  onClick={() => handleSelect(node)}
                  className={cn(
                    'flex h-8 w-full cursor-default items-center gap-1.5 d px-2 text-left text-sm outline-none select-none focus:bg-accent',
                    active && 'bg-muted',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate" title={displayName(node)}>
                    {displayName(node)}
                  </span>
                  {hasChildren ? (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
