import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

/** 单个步骤配置 */
export interface StepperStep {
  /** 步骤标题 */
  title: string
  /** 步骤说明（标题下方一行，可省略） */
  description?: string
}

interface StepperProps {
  /** 步骤列表，顺序即展示顺序 */
  steps: readonly StepperStep[]
  /** 当前步骤下标（从 0 开始）：小于它的为已完成，等于它的为进行中，其余为待开始 */
  current: number
  /** 排列方向，默认横向 */
  orientation?: 'horizontal' | 'vertical'
  /** 点击步骤回调；不传则步骤不可交互 */
  onStepClick?: (index: number) => void
  /** 该步是否禁用点击（当前步始终不可点） */
  isStepDisabled?: (index: number) => boolean
  /** 外层容器扩展类名（宽度等布局用） */
  className?: string
}

interface StepTriggerProps {
  /** 是否可交互（不可交互时降级为普通容器，避免无意义的焦点位） */
  interactive: boolean
  onClick?: () => void
  className?: string
  children: ReactNode
}

/** 步骤触发容器：可交互时渲染为 button，否则渲染为 div */
function StepTrigger({ interactive, onClick, className, children }: StepTriggerProps) {
  if (!interactive) {
    return <div className={className}>{children}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg text-left transition-colors hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface StepCircleProps {
  index: number
  isCompleted: boolean
  isActive: boolean
}

/** 步骤序号圆圈：完成打勾 / 进行中高亮 / 待开始置灰 */
function StepCircle({ index, isCompleted, isActive }: StepCircleProps) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
        isCompleted && 'border-primary bg-primary text-primary-foreground',
        isActive && 'border-primary bg-background text-primary',
        !isCompleted && !isActive && 'border-border text-muted-foreground',
      )}
    >
      {isCompleted ? <Check className="size-3.5" /> : index + 1}
    </span>
  )
}

interface StepTextProps {
  step: StepperStep
  isActive: boolean
  isCompleted: boolean
  /** 竖向排列时标题换行而非截断 */
  wrap?: boolean
  className?: string
}

/** 步骤标题与说明 */
function StepText({ step, isActive, isCompleted, wrap, className }: StepTextProps) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span
        className={cn(
          'text-sm',
          wrap ? 'break-words' : 'truncate',
          isActive && 'font-medium text-foreground',
          isCompleted && 'text-foreground',
          !isActive && !isCompleted && 'text-muted-foreground',
        )}
      >
        {step.title}
      </span>
      {step.description ? (
        <span
          className={cn(
            'text-xs text-muted-foreground',
            wrap ? 'break-words' : 'truncate',
          )}
        >
          {step.description}
        </span>
      ) : null}
    </div>
  )
}

/**
 * 公共步骤条：展示多步流程的进度（已完成 / 进行中 / 待开始）。
 * 纯展示组件，状态由 current 派生；传入 onStepClick 后已完成/已解锁的步骤可点击跳转。
 */
export function Stepper({
  steps,
  current,
  orientation = 'horizontal',
  onStepClick,
  isStepDisabled,
  className,
}: StepperProps) {
  const isVertical = orientation === 'vertical'

  return (
    <ol
      className={cn(
        'flex w-full',
        isVertical ? 'flex-col' : 'flex-wrap items-center gap-x-3 gap-y-4',
        className,
      )}
    >
      {steps.map((step, index) => {
        const isCompleted = index < current
        const isActive = index === current
        const isLast = index === steps.length - 1
        const isInteractive =
          Boolean(onStepClick) && !isActive && !(isStepDisabled?.(index) ?? false)
        const handleClick = () => onStepClick?.(index)

        if (isVertical) {
          return (
            <li key={step.title} aria-current={isActive ? 'step' : undefined} className="flex">
              <StepTrigger
                interactive={isInteractive}
                onClick={handleClick}
                className="flex w-full items-start gap-3 px-2 py-1"
              >
                <span className="flex flex-col items-center self-stretch">
                  <StepCircle index={index} isCompleted={isCompleted} isActive={isActive} />
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'my-1 w-px flex-1',
                        isCompleted ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  ) : null}
                </span>
                <StepText
                  step={step}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  wrap
                  className={cn(!isLast && 'pb-6')}
                />
              </StepTrigger>
            </li>
          )
        }

        return (
          <li
            key={step.title}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-3',
              isLast ? 'flex-none' : 'flex-1',
            )}
          >
            <StepTrigger
              interactive={isInteractive}
              onClick={handleClick}
              className="flex min-w-0 items-center gap-3 px-1 py-0.5"
            >
              <StepCircle index={index} isCompleted={isCompleted} isActive={isActive} />
              <StepText step={step} isActive={isActive} isCompleted={isCompleted} />
            </StepTrigger>
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px min-w-6 flex-1',
                  isCompleted ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
