import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/lib/utils'

interface CopyableCodeProps {
  /** 要展示并复制的文本（通常是实体 ID） */
  value: string
  /** 透传到外层容器的类名，用于宽度等布局微调 */
  className?: string
}

/** 可复制的 ID 片段：等宽字体代码块 + 复制按钮，列表与详情弹框共用 */
export function CopyableCode({ value, className }: CopyableCodeProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <code className="min-w-0 max-w-44 truncate d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  )
}
