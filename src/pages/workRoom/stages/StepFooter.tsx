import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface StepFooterProps {
  /** 上一步回调，缺省则不渲染上一步按钮 */
  onPrev?: () => void
  /** 下一步回调，缺省则不渲染下一步按钮 */
  onNext?: () => void
  /** 下一步是否禁用 */
  nextDisabled?: boolean
  prevLabel?: string
  nextLabel?: string
}

/** 步骤底部导航：左侧上一步、右侧下一步 */
export function StepFooter({
  onPrev,
  onNext,
  nextDisabled,
  prevLabel = '上一步',
  nextLabel = '下一步',
}: StepFooterProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2">
      {onPrev ? (
        <Button variant="outline" data-icon="inline-start" onClick={onPrev}>
          <ArrowLeft />
          {prevLabel}
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
      {onNext ? (
        <Button data-icon="inline-end" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
          <ArrowRight />
        </Button>
      ) : null}
    </div>
  )
}
