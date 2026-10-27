import { Loader2, Subtitles, TriangleAlert } from 'lucide-react'
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
import type { SceneSplitScene } from '@/types/scene-split'
import type { SceneTranscribeSceneSegments } from '@/types/scene-transcribe'
import { formatClockMs, formatDurationMs } from '@/utils/format'
import { StepFooter } from '../stages/StepFooter'
import type { SceneTranscribeStageController } from './controller'

interface SceneTranscribeStepProps {
  factory: SceneTranscribeStageController
}

/**
 * 步骤 · 场景转写：以场景切分任务为来源提交语音转写任务，轮询排队位置与进度；
 * 成功后按场景展示转写文本，展开场景行可查看该场景的时间轴分段。
 */
export function SceneTranscribeStep({ factory }: SceneTranscribeStepProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => new Set())

  // 按场景序号索引转写结果，供表行展开按 index 取
  const segmentsByScene = useMemo(() => {
    const map = new Map<number, SceneTranscribeSceneSegments>()
    factory.transcribeSceneSegments.forEach((item) => map.set(item.index, item))
    return map
  }, [factory.transcribeSceneSegments])

  // 仅有文本分段的场景可展开
  const handleToggleRow = useCallback(
    (scene: SceneSplitScene) => {
      const group = segmentsByScene.get(scene.index)
      if (!group || group.segments.length === 0) return
      setExpandedIndices((prev) => {
        const next = new Set(prev)
        if (next.has(scene.index)) next.delete(scene.index)
        else next.add(scene.index)
        return next
      })
    },
    [segmentsByScene],
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
      {
        key: 'segmentCount',
        title: '分段数',
        align: 'right',
        className: 'tabular-nums',
        render: (scene) => segmentsByScene.get(scene.index)?.segments.length ?? 0,
      },
    ],
    [segmentsByScene],
  )

  const renderExpanded = useCallback(
    (scene: SceneSplitScene): ReactNode => {
      const group = segmentsByScene.get(scene.index)
      if (!group || group.segments.length === 0) {
        return <p className="text-sm text-muted-foreground">该场景暂无转写文本。</p>
      }
      return (
        <ol className="flex flex-col gap-2 py-1">
          {group.segments.map((segment) => (
            <li
              key={`${segment.startMs}-${segment.endMs}`}
              className="flex flex-col gap-1 rounded-xl border border-border bg-background px-3 py-2"
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatClockMs(segment.startMs)} – {formatClockMs(segment.endMs)}
              </span>
              <span className="text-sm">{segment.text}</span>
            </li>
          ))}
        </ol>
      )
    },
    [segmentsByScene],
  )

  const task = factory.transcribeTask
  const hasResult = factory.transcribeStatus === 'success' && task !== null
  const percent = Math.round(factory.transcribeProgress * 100)

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>场景转写</CardTitle>
        <CardDescription>
          基于场景切分结果逐场景转写语音内容，展开场景行可查看该场景的时间轴分段。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {hasResult && task ? (
          <div className="grid gap-x-6 gap-y-1 xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-4">
            <span>
              分段数：<span className="text-foreground tabular-nums">{task.segmentCount}</span>
            </span>
            <span>
              场景数：<span className="text-foreground tabular-nums">{task.sceneCount}</span>
            </span>
            <span>
              视频时长：
              <span className="text-foreground tabular-nums">{formatDurationMs(task.durationMs)}</span>
            </span>
            <span>识别后端：{task.provider || '—'}</span>
          </div>
        ) : null}

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={!factory.canTranscribe || factory.isTranscribing}
          onClick={factory.transcribe}
        >
          {factory.isTranscribing ? <Loader2 className="animate-spin" /> : <Subtitles />}
          {factory.isTranscribing ? '转写中…' : hasResult ? '重新转写' : '开始转写'}
        </Button>

        {factory.transcribeStatus === 'pending' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.transcribeQueuePosition ?? '-'} 位
              {factory.transcribeQueueDepth > 0
                ? ` · 前方 ${factory.transcribeWaitingAhead} 个任务`
                : ''}
            </span>
          </div>
        ) : null}

        {factory.transcribeStatus === 'running' ? (
          <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.transcribeStageLabel || '转写中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.transcribeStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>转写失败</AlertTitle>
            <AlertDescription>{factory.transcribeError || '请稍后重试。'}</AlertDescription>
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
              isRowExpandable: (scene) =>
                (segmentsByScene.get(scene.index)?.segments.length ?? 0) > 0,
              renderExpanded,
            }}
            emptyTitle="暂无场景"
            emptyDescription="请先在上一步完成场景切分。"
          />
        </div>
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={!factory.isFrameExtractDone}
        />
      </CardFooter>
    </Card>
  )
}
