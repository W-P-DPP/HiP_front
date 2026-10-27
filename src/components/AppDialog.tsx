import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type AppDialogSize = 'sm' | 'md' | 'lg'

/** 宽度预设,覆盖 dialog 默认的 sm:max-w-sm(经 tailwind-merge 去重生效) */
const DIALOG_SIZE_CLASS: Record<AppDialogSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

export interface AppDialogProps {
  /** 受控开关 */
  open: boolean
  /** 开关回调 */
  onOpenChange: (open: boolean) => void
  /** 标题(必填,弹框必须有 Title) */
  title: ReactNode
  /** 可选说明文案 */
  description?: ReactNode
  /** 弹框主体内容(表单/文案等) */
  children?: ReactNode
  /** 宽度预设,默认 md(28rem) */
  size?: AppDialogSize
  /** 确认按钮文案,默认「确认」 */
  confirmText?: string
  /** 取消按钮文案,默认「取消」 */
  cancelText?: string
  /** 点击确认回调;提交由调用方处理,成功后自行 onOpenChange(false) */
  onConfirm?: () => void
  /** 点击取消回调,默认关闭弹框 */
  onCancel?: () => void
  /** 确认按钮 loading(提交中禁用,防止重复提交) */
  confirmLoading?: boolean
  /** 确认按钮禁用 */
  confirmDisabled?: boolean
  /** 隐藏取消按钮(仅确认型操作) */
  hideCancel?: boolean
  /** 自定义底部,传入后整体覆盖默认按钮 */
  footer?: ReactNode
  /** 透传给 DialogContent 的类名 */
  contentClassName?: string
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  confirmLoading = false,
  confirmDisabled = false,
  hideCancel = false,
  footer,
  contentClassName,
}: AppDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZE_CLASS[size], contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children ? (
          <div className="max-h-[70dvh] overflow-y-auto pr-1">{children}</div>
        ) : null}
        <DialogFooter>
          {footer ?? (
            <>
              {!hideCancel ? (
                <Button variant="outline" onClick={handleCancel}>
                  {cancelText}
                </Button>
              ) : null}
              <Button
                onClick={onConfirm}
                disabled={confirmLoading || confirmDisabled}
                data-icon={confirmLoading ? 'inline-start' : undefined}
              >
                {confirmLoading ? <Loader2 className="animate-spin" /> : null}
                {confirmText}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
