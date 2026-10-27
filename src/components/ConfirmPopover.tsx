import { useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ConfirmPopoverProps {
  /** 触发器内容（图标按钮等） */
  children: ReactNode
  /** 确认弹层标题，默认「确认删除」 */
  title?: string
  /** 确认文案说明 */
  description?: string
  /** 确认按钮文案，默认「确认删除」 */
  confirmText?: string
  /** 确认按钮 loading（提交中禁用，防重复点击） */
  confirmLoading?: boolean
  /** 点击确认后的回调（可异步），执行完成后关闭弹层 */
  onConfirm: () => void | Promise<void>
}

/**
 * 删除二次确认公共组件：所有删除操作必须二次确认，统一用本组件承接（固化要求）。
 * 触发器为 ghost 图标按钮；确认按钮为 destructive 语义色。
 */
export function ConfirmPopover({
  children,
  title = '确认删除',
  description,
  confirmText = '确认删除',
  confirmLoading = false,
  onConfirm,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label={title} />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description ? (
            <PopoverDescription>{description}</PopoverDescription>
          ) : null}
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={confirmLoading}
            data-icon={confirmLoading ? 'inline-start' : undefined}
          >
            {confirmLoading ? <Loader2 className="animate-spin" /> : null}
            {confirmText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
