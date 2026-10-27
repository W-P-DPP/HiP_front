import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** 详情项：id 为稳定 key；label 为字段名；value 为渲染内容；wide 时占满整行 */
export interface DetailField {
  id: string
  label: ReactNode
  value: ReactNode
  wide?: boolean
}

export interface DetailDialogProps {
  /** 受控开关 */
  open: boolean
  /** 开关回调 */
  onOpenChange: (open: boolean) => void
  /** 弹框标题（必填，弹框必须有 Title） */
  title: ReactNode
  /** 可选说明文案 */
  description?: ReactNode
  /** 详情加载中：渲染骨架占位 */
  loading?: boolean
  /** 详情加载失败 */
  error?: Error | null
  /** 详情字段列表 */
  fields?: readonly DetailField[]
}

/** 加载骨架行数 */
const SKELETON_FIELDS = 6

function renderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {Array.from({ length: SKELETON_FIELDS }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

/**
 * 只读详情弹框：以字段列表（label/value）展示单条记录详情。
 * 自带加载骨架与失败提示，数据由调用方通过 react-query 拉取。
 */
export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  loading = false,
  error,
  fields = [],
}: DetailDialogProps) {
  let body: ReactNode
  if (loading) {
    body = renderSkeleton()
  } else if (error) {
    body = (
      <p className="py-8 text-center text-sm text-destructive">
        {error.message || '加载详情失败，请稍后重试'}
      </p>
    )
  } else {
    body = (
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className={cn('flex min-w-0 flex-col gap-1', field.wide && 'sm:col-span-2')}
          >
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="text-sm break-words text-foreground">{field.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto px-1 pb-1">{body}</div>
      </DialogContent>
    </Dialog>
  )
}
