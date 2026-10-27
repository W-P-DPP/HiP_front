import { ChevronRight, Inbox, Plus, RotateCcw, Search } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import {
  createChildUser,
  getUserChildrenList,
  userQueryKeys,
} from '@/api/user'
import { AppDialog } from '@/components/AppDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { usePermission, ROLE } from '@/hooks/use-permission'
import type { Role, UserTreeNode } from '@/types/user'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/lib/utils'

/** 角色中文名（表格「角色」列 + 创建弹框角色下拉） */
const ROLE_LABEL: Record<Role, string> = {
  sadmin: '超级管理员',
  admin: '管理员',
  user: '用户',
}

/** sadmin 可为其子账号选择的角色：admin/user（不允许再建并列的 sadmin） */
const CREATE_ROLE_OPTIONS: readonly Role[] = ['admin', 'user']

/** 角色徽章配色：sadmin 强调填充、admin 次级、user 描边 */
const ROLE_BADGE_VARIANT: Record<Role, 'default' | 'secondary' | 'outline'> = {
  sadmin: 'default',
  admin: 'secondary',
  user: 'outline',
}

const TABLE_COLUMNS = 4
const SKELETON_ROWS = 5
/** 每层级的缩进像素，使树结构在首列视觉上错开 */
const INDENT_PER_LEVEL = 20

/** 当前行在展示中的形态（把嵌套树摊平为行序，便于按 DOM 顺序渲染） */
interface TreeRow {
  node: UserTreeNode
  depth: number
}

/** 收集树中全部节点 id，用于首次加载默认整树展开 */
function collectNodeIds(nodes: readonly UserTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: readonly UserTreeNode[]) => {
    for (const node of list) {
      ids.push(node.id)
      walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

/**
 * 账号/昵称过滤命中判定：关键词为空串表示该维度不过滤；
 * 两个关键词同时给出时需（AND）同时命中。
 */
function matchUser(node: UserTreeNode, accountKw: string, nicknameKw: string) {
  const matchAccount = accountKw === '' || node.account.includes(accountKw)
  const matchNickname = nicknameKw === '' || node.nickname.includes(nicknameKw)
  return matchAccount && matchNickname
}

/**
 * 树过滤：命中任意深度的节点时保留其祖先链（未命中兄弟被裁剪）；
 * 命中自身时连同整个子树一起展示，便于就地展开查看。
 */
function filterChildren(
  nodes: readonly UserTreeNode[],
  accountKw: string,
  nicknameKw: string,
): UserTreeNode[] {
  const kept: UserTreeNode[] = []
  for (const node of nodes) {
    if (matchUser(node, accountKw, nicknameKw)) {
      kept.push(node)
      continue
    }
    const keptChildren = filterChildren(node.children, accountKw, nicknameKw)
    // 子级有命中 → 本层保留作上下文祖先，仅裁剪后的分支跟随展示
    if (keptChildren.length > 0) {
      kept.push({ ...node, children: keptChildren })
    }
  }
  return kept
}

/**
 * 把根节点摊平成可见行序列；仅当节点有子级且（强制全展开 或 在展开集合中）时下钻。
 * 过滤激活时 forceExpandAll=true（忽略手动收起），保证命中行不会被父级折叠隐藏。
 */
function flattenRows(
  roots: readonly UserTreeNode[],
  expanded: ReadonlySet<string>,
  forceExpandAll: boolean,
): TreeRow[] {
  const rows: TreeRow[] = []
  const walk = (list: readonly UserTreeNode[], depth: number) => {
    for (const node of list) {
      rows.push({ node, depth })
      const hasChildren = node.children.length > 0
      if (hasChildren && (forceExpandAll || expanded.has(node.id))) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(roots, 0)
  return rows
}

export function UsersPage() {
  // 权限：仅 sadmin 创建时可选角色（页面入口已按 EROLE.admin 过滤，能进入的都是 admin 以上）
  const { role } = usePermission()
  const isSadmin = role === ROLE.SADMIN

  // 当前用户下整棵用户树（后端以当前用户为根返回，无分页）
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: userQueryKeys.children,
    queryFn: getUserChildrenList,
  })

  // 搜索：两个框的输入态与「已应用」态分离，点搜索才生效、点重置清空
  const [accountInput, setAccountInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [accountKw, setAccountKw] = useState('')
  const [nicknameKw, setNicknameKw] = useState('')

  // 树的展开状态：默认（首次取到数据时）整树展开，用户可手动收起
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const seededRef = useRef(false)
  useEffect(() => {
    const list = data?.list
    if (!list || list.length === 0 || seededRef.current) return
    seededRef.current = true
    setExpanded(new Set(collectNodeIds(list)))
  }, [data])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 过滤激活时才裁剪树；未激活直接用后端返回的根节点
  const hasFilter = accountKw !== '' || nicknameKw !== ''
  const displayRoots = useMemo(() => {
    const list = data?.list ?? []
    if (!hasFilter) return list
    return filterChildren(list, accountKw, nicknameKw)
  }, [data, hasFilter, accountKw, nicknameKw])

  const rows = useMemo(
    () => flattenRows(displayRoots, expanded, hasFilter),
    [displayRoots, expanded, hasFilter],
  )

  // 创建子账号
  const [createOpen, setCreateOpen] = useState(false)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const createUser = useMutation({ mutationFn: createChildUser })

  const resetCreateForm = useCallback(() => {
    setAccount('')
    setPassword('')
    setNewRole('user')
  }, [])

  const handleCreate = useCallback(async () => {
    const accountValue = account.trim()
    if (!accountValue || !password) return
    try {
      await createUser.mutateAsync({
        account: accountValue,
        password,
        // 仅 sadmin 指定角色；其余角色由后端默认为 user
        ...(isSadmin ? { role: newRole } : {}),
      })
      setCreateOpen(false)
      resetCreateForm()
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [account, password, isSadmin, newRole, createUser, resetCreateForm, refetch])

  const handleSearch = () => {
    setAccountKw(accountInput.trim())
    setNicknameKw(nicknameInput.trim())
  }

  const handleReset = () => {
    setAccountInput('')
    setNicknameInput('')
    setAccountKw('')
    setNicknameKw('')
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const canSubmit = account.trim() !== '' && password !== ''
    if (event.key === 'Enter' && canSubmit && !createUser.isPending) {
      handleCreate()
    }
  }

  const canCreate = account.trim() !== '' && password !== ''

  // —— 表格主体（骨架 / 错误 / 空态 / 数据行），复刻 DataTable 的状态分支 ——
  const totalRows = data?.list.length ?? 0
  let bodyContent: ReactNode

  if (isLoading) {
    bodyContent = Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: TABLE_COLUMNS }, (_, colIndex) => (
          <TableCell key={colIndex}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ))
  } else if (error && totalRows === 0) {
    bodyContent = (
      <TableRow>
        <TableCell colSpan={TABLE_COLUMNS} className="py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-destructive">
              {error.message || '加载失败，请稍后重试'}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  } else if (rows.length === 0) {
    const searchingNoMatch = totalRows > 0
    bodyContent = (
      <TableRow>
        <TableCell colSpan={TABLE_COLUMNS} className="py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center xl bg-muted">
              <Inbox className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {searchingNoMatch ? '未找到匹配的用户' : '暂无用户'}
              </span>
              <span className="text-sm text-muted-foreground">
                {searchingNoMatch
                  ? '换个账号或昵称关键词试试，或点击「重置」。'
                  : '账号创建后将展示在层级列表中。'}
              </span>
            </div>
          </div>
        </TableCell>
      </TableRow>
    )
  } else {
    bodyContent = rows.map(({ node, depth }) => {
      const hasChildren = node.children.length > 0
      // 过滤激活时忽略手动收起（flatten 已强制全展开），chevron 状态需与展示一致
      const isExpanded = hasFilter || expanded.has(node.id)
      return (
        <TableRow key={node.id}>
          <TableCell>
            <div
              className="flex items-center gap-1.5"
              style={{ paddingLeft: depth * INDENT_PER_LEVEL }}
            >
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={isExpanded ? '收起' : '展开'}
                  aria-expanded={isExpanded}
                  className="text-muted-foreground"
                  onClick={() => toggleExpand(node.id)}
                >
                  <ChevronRight
                    className={cn(
                      'transition-transform duration-200',
                      isExpanded && 'rotate-90',
                    )}
                  />
                </Button>
              ) : (
                // 叶子行留等宽占位，保证缩进下的文字与父行对齐
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center"
                />
              )}
              {node.avatar ? (
                <img
                  src={node.avatar}
                  alt=""
                  className="size-6 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <span className="truncate font-medium tabular-nums">
                {node.account}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <span className="text-muted-foreground">{node.nickname || '—'}</span>
          </TableCell>
          <TableCell>
            <Badge variant={ROLE_BADGE_VARIANT[node.role]}>
              {ROLE_LABEL[node.role]}
            </Badge>
          </TableCell>
          <TableCell className="tabular-nums text-muted-foreground">
            {formatDateTime(node.createdAt ?? '')}
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">用户</h1>
        <p className="text-sm text-muted-foreground">用户列表与账号管理。</p>
      </div>

      {/* 搜索 + 操作工具栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索账号"
          value={accountInput}
          onChange={(event) => setAccountInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-56"
        />
        <Input
          placeholder="搜索昵称"
          value={nicknameInput}
          onChange={(event) => setNicknameInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-56"
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
          新增用户
        </Button>
      </div>

      {/* 树表格：无现成可展开组件，用 shadcn Table 原语按层级递归摊平渲染 */}
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">账号</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>角色</TableHead>
              <TableHead className="tabular-nums">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody
            className={cn(
              'transition-opacity',
              isFetching && !isLoading && 'opacity-60',
            )}
          >
            {bodyContent}
          </TableBody>
        </Table>
      </div>

      {/* 创建子账号 */}
      <AppDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm() // 关闭时清空，避免下次打开残留
        }}
        title="新增用户"
        description="创建当前用户下的子账号，创建后子账号可登录并按层级管理下级。"
        confirmText="创建"
        confirmLoading={createUser.isPending}
        confirmDisabled={!canCreate}
        onConfirm={handleCreate}
      >
        <div className="flex flex-col gap-3 px-2.5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-user-account">账号</Label>
            <Input
              id="create-user-account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              onKeyDown={handleCreateKeyDown}
              placeholder="请输入账号"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-user-password">密码</Label>
            <Input
              id="create-user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handleCreateKeyDown}
              placeholder="请输入密码"
            />
          </div>
          {isSadmin ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-user-role">角色</Label>
              <Select
                value={newRole}
                onValueChange={(value) => setNewRole(value as Role)}
              >
                <SelectTrigger id="create-user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATE_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ROLE_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </AppDialog>
    </div>
  )
}
