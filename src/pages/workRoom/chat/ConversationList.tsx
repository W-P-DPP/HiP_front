import {
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Plus,
  Trash2,
} from 'lucide-react'

import { ConfirmPopover } from '@/components/ConfirmPopover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AiConversation } from '@/types/ai-chat'
import { formatRelativeTime } from '@/utils/format'

/** 加载态骨架行数 */
const SKELETON_ROWS = 6

export interface ConversationListProps {
  conversations: AiConversation[]
  /** 当前选中的会话 id */
  activeId: string | null
  loading: boolean
  error: Error | null
  /** 删除请求进行中（禁用确认按钮） */
  deleting: boolean
  page: number
  totalPages: number
  onSelect: (conversation: AiConversation) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRetry: () => void
  onPageChange: (page: number) => void
}

/** 会话列表：顶部新建入口，列表项悬浮出删除（二次确认） */
export function ConversationList({
  conversations,
  activeId,
  loading,
  error,
  deleting,
  page,
  totalPages,
  onSelect,
  onCreate,
  onDelete,
  onRetry,
  onPageChange,
}: ConversationListProps) {
  const isEmpty = conversations.length === 0

  let content = (
    <ul className="flex flex-col gap-1">
      {conversations.map((conversation) => {
        const isActive = conversation._id === activeId
        return (
          // 删除按钮与会话按钮同级（不能嵌套 button），故用相对定位的兄弟节点悬浮展示
          <li key={conversation._id} className="group/conv relative">
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(conversation)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-xl py-2.5 pr-10 pl-3 text-left transition-colors',
                isActive ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              <span className="truncate text-sm font-medium">
                {conversation.title}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <span>{conversation.messageCount} 条</span>
                <span>·</span>
                <span>
                  {conversation.lastMessageAt
                    ? formatRelativeTime(conversation.lastMessageAt)
                    : '暂无消息'}
                </span>
              </span>
            </button>
            <div className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/conv:opacity-100 focus-within:opacity-100">
              <ConfirmPopover
                title="确认删除"
                description={`确认删除会话「${conversation.title}」？删除后不可恢复。`}
                confirmLoading={deleting}
                onConfirm={() => onDelete(conversation._id)}
              >
                <Trash2 />
              </ConfirmPopover>
            </div>
          </li>
        )
      })}
    </ul>
  )

  if (loading) {
    content = (
      <div className="flex flex-col gap-2 p-1.5">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  } else if (error && isEmpty) {
    content = (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="text-sm text-destructive">{error.message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      </div>
    )
  } else if (isEmpty) {
    content = (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center xl bg-muted">
          <MessagesSquare className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">暂无会话</span>
          <span className="text-sm text-muted-foreground">
            新建会话后即可开始与 AI 对话。
          </span>
        </div>
        <Button data-icon="inline-start" size="sm" onClick={onCreate}>
          <Plus />
          新建会话
        </Button>
      </div>
    )
  }

  return (
    // 窄屏在上方占固定高度、宽屏在左侧占固定宽度（避免挤压对话区）
    <aside className="flex h-64 w-full shrink-0 flex-col overflow-hidden xl border border-border bg-card lg:h-auto lg:w-72">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium">会话</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="新建会话"
          onClick={onCreate}
        >
          <Plus />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1.5">
        {content}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
