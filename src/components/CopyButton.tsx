import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/utils/clipboard'
import { message } from '@/utils/message'

interface CopyButtonProps {
  /** 要复制的文本 */
  value: string
  /** 复制成功提示文案，默认「复制成功」 */
  successMessage?: string
  className?: string
}

/** 复制按钮：点击复制 value，成功后图标临时切换为对勾并 toast 提示 */
export function CopyButton({
  value,
  successMessage = '复制成功',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  // 卸载时清理未触发的还原定时器
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (!ok) {
      message.error('复制失败，请手动复制')
      return
    }
    setCopied(true)
    message.success(successMessage)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? '已复制' : '复制'}
      onClick={handleCopy}
      className={cn(className)}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
