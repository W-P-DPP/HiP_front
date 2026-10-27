import { Film, Loader2, TriangleAlert } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FRAME_KIND_LABELS } from '@/constant/scene-process'
import type { SceneSplitScene } from '@/types/scene-split'
import { formatClockMs, formatDurationMs } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { StepFooter } from '../stages/StepFooter'
import type { FrameExtractStageController } from './controller'

interface FrameExtractStepProps {
  factory: FrameExtractStageController
}

/**
 * 步骤 · 抽帧：以场景切分任务为来源提交抽帧任务，轮询排队位置与进度；
 * 场景表复刻场景切分结果，抽帧成功后每行可展开查看该场景的关键帧图片。
 */
export function FrameExtractStep({ factory }: FrameExtractStepProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => new Set())

  const { framesByScene } = factory

  // 仅已抽到帧的场景可展开；无帧不展示箭头
  const handleToggleRow = useCallback(
    (scene: SceneSplitScene) => {
      if (!framesByScene.has(scene.index)) return
      setExpandedIndices((prev) => {
        const next = new Set(prev)
        if (next.has(scene.index)) next.delete(scene.index)
        else next.add(scene.index)
        return next
      })
    },
    [framesByScene],
  )

  const columns = useMemo<DataTableColumn<SceneSplitScene>[]>(
    () => [
      { key: 'index', title: '序号', width: 'w-24' },
      {
        key: 'startMs',
        title: '开始',
        align: 'right',
        className: 'tabular-nums',
        render: (scene) => formatClockMs(scene.startMs),
      },
      {
        key: 'endMs',
        title: '结束',
        align: 'right',
        className: 'tabular-nums',
        render: (scene) => formatClockMs(scene.endMs),
      },
      {
        key: 'durationMs',
        title: '时长',
        align: 'right',
        className: 'tabular-nums',
        render: (scene) => formatClockMs(scene.durationMs),
      },
    ],
    [],
  )

  const renderExpanded = useCallback(
    (scene: SceneSplitScene): ReactNode => {
      const group = framesByScene.get(scene.index)
      if (!group || group.frames.length === 0) {
        return <p className="text-sm text-muted-foreground">该场景暂无抽帧结果。</p>
      }
      return (
        <div className="flex flex-col gap-3 py-1">
          <span className="text-xs text-muted-foreground">
            共 <span className="tabular-nums">{group.frames.length}</span> 帧
          </span>
          <div className="flex flex-wrap gap-4">
            {group.frames.map((frame) => (
              <figure key={frame.kind} className="flex w-48 flex-col gap-2">
                <img
                  src={resolveMediaUrl(frame.url)}
                  alt={`序号 ${scene.index} · ${FRAME_KIND_LABELS[frame.kind] ?? frame.kind}`}
                  loading="lazy"
                  className="h-32 w-full rounded-lg border border-border bg-muted object-contain"
                />
                <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{FRAME_KIND_LABELS[frame.kind] ?? frame.kind}</span>
                  <span className="tabular-nums">{formatClockMs(frame.timeMs)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )
    },
    [framesByScene],
  )

  const task = factory.frameTask
  const hasResult = factory.frameStatus === 'success' && task !== null
  const percent = Math.round(factory.frameProgress * 100)

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>抽帧</CardTitle>
        <CardDescription>
          基于场景切分结果，为每个场景抽取起始 / 中间 / 结束关键帧，展开场景行可查看抽帧图片。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {hasResult && task ? (
          <div className="grid gap-x-6 gap-y-1 xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-4">
            <span>
              抽帧总数：<span className="text-foreground tabular-nums">{task.frameCount}</span>
            </span>
            <span>
              场景数：<span className="text-foreground tabular-nums">{task.sceneCount}</span>
            </span>
            <span>
              视频时长：
              <span className="text-foreground tabular-nums">{formatDurationMs(task.durationMs)}</span>
            </span>
            <span>
              帧率：<span className="text-foreground tabular-nums">{task.frameRate.toFixed(2)}</span>
            </span>
          </div>
        ) : null}

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={!factory.canExtractFrames || factory.isExtractingFrames}
          onClick={factory.extractFrames}
        >
          {factory.isExtractingFrames ? <Loader2 className="animate-spin" /> : <Film />}
          {factory.isExtractingFrames ? '抽帧中…' : hasResult ? '重新抽帧' : '开始抽帧'}
        </Button>

        {factory.frameStatus === 'pending' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.frameQueuePosition ?? '-'} 位
              {factory.frameQueueDepth > 0
                ? ` · 前方 ${factory.frameWaitingAhead} 个任务`
                : ''}
            </span>
          </div>
        ) : null}

        {factory.frameStatus === 'running' ? (
          <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.frameStageLabel || '抽帧中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.frameStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>抽帧失败</AlertTitle>
            <AlertDescription>{factory.frameError || '请稍后重试。'}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">场景列表</span>
          <DataTable
            columns={columns}
            data={factory.scenes}
            rowKey={(scene) => scene.index}
            loading={factory.scenesLoading}
            onRowClick={handleToggleRow}
            expansion={{
              expandedKeys: expandedIndices,
              onToggleRow: handleToggleRow,
              isRowExpandable: (scene) => framesByScene.has(scene.index),
              renderExpanded,
            }}
            emptyTitle="暂无场景"
            emptyDescription="请先在上一步完成场景切分。"
          />
        </div>
      </CardContent>
      <CardFooter>
        <StepFooter onPrev={factory.goPrev} onNext={factory.goNext} />
      </CardFooter>
    </Card>
  )
}
