import { Loader2, ScanEye, TriangleAlert } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FRAME_KIND_LABELS, VLM_MODE_OPTIONS, isVlmTaskMode } from '@/constant/scene-process'
import type { SceneSplitScene } from '@/types/scene-split'
import type { VlmBatchItem } from '@/types/vlm-batch'
import { formatClockMs } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { StepFooter } from '../stages/StepFooter'
import type { SceneRecognizeStageController } from './controller'

/** 一组成员徽标（物体 / 动作 / 标签），空数组不渲染 */
function ResultBadges({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {items.map((item) => (
        <Badge key={item} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  )
}

/** 单张关键帧的识别结果：缩略图 + 描述 + 结构化字段 */
function FrameResultCard({ item }: { item: VlmBatchItem }) {
  const label = FRAME_KIND_LABELS[item.frameKind] ?? item.frameKind
  const result = item.result

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row">
      <img
        src={resolveMediaUrl(item.url)}
        alt={`序号 ${item.sceneIndex} · ${label}`}
        loading="lazy"
        className="h-32 w-full shrink-0 rounded-lg border border-border bg-muted object-contain sm:w-48"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">{formatClockMs(item.timeMs)}</span>
          {item.modelId ? <span>{item.modelId}</span> : null}
        </div>

        {item.status === 'success' && result ? (
          <>
            <p className="text-sm">{result.description || '—'}</p>
            {result.sceneType ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">场景类型</span>
                <Badge variant="outline">{result.sceneType}</Badge>
              </div>
            ) : null}
            <ResultBadges label="物体" items={result.objects} />
            <ResultBadges label="动作" items={result.actions} />
            <ResultBadges label="标签" items={result.tags} />
          </>
        ) : (
          <span className="text-sm text-destructive">{item.message || '识别失败'}</span>
        )}
      </div>
    </div>
  )
}

interface SceneRecognizeStepProps {
  factory: SceneRecognizeStageController
}

/**
 * 步骤 · 场景图像识别：以抽帧任务为来源提交批量图像识别任务（整批共用 mode / prompt），
 * 轮询排队位置与进度；场景表复刻场景切分结果，识别成功后每行可展开查看各关键帧的识别结果。
 */
export function SceneRecognizeStep({ factory }: SceneRecognizeStepProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => new Set())

  const { batchItemsByScene } = factory

  // 仅已识别出结果的场景可展开
  const handleToggleRow = useCallback(
    (scene: SceneSplitScene) => {
      const items = batchItemsByScene.get(scene.index)
      if (!items || items.length === 0) return
      setExpandedIndices((prev) => {
        const next = new Set(prev)
        if (next.has(scene.index)) next.delete(scene.index)
        else next.add(scene.index)
        return next
      })
    },
    [batchItemsByScene],
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
        key: 'recognizedCount',
        title: '已识别',
        align: 'right',
        className: 'tabular-nums',
        render: (scene) => batchItemsByScene.get(scene.index)?.length ?? 0,
      },
    ],
    [batchItemsByScene],
  )

  const renderExpanded = useCallback(
    (scene: SceneSplitScene): ReactNode => {
      const items = batchItemsByScene.get(scene.index)
      if (!items || items.length === 0) {
        return <p className="text-sm text-muted-foreground">该场景暂无识别结果。</p>
      }
      return (
        <div className="flex flex-col gap-3 py-1">
          {items.map((item) => (
            <FrameResultCard key={item.index} item={item} />
          ))}
        </div>
      )
    },
    [batchItemsByScene],
  )

  const task = factory.batchTask
  const hasResult = factory.batchStatus === 'success' && task !== null
  const percent = Math.round(factory.batchProgress * 100)

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>场景图像识别</CardTitle>
        <CardDescription>
          基于抽帧结果批量识别每张关键帧的画面内容，展开场景行可查看各帧的识别结果。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {hasResult && task ? (
          <div className="grid gap-x-6 gap-y-1 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-4">
            <span>
              总项数：<span className="text-foreground tabular-nums">{task.total}</span>
            </span>
            <span>
              成功：<span className="text-foreground tabular-nums">{task.succeeded}</span>
            </span>
            <span>
              失败：<span className="text-foreground tabular-nums">{task.failed}</span>
            </span>
            <span>输出模式：{task.mode || '—'}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>输出模式</Label>
            <ToggleGroup
              value={[factory.batchMode]}
              onValueChange={(value) => {
                const next = value[0]
                if (isVlmTaskMode(next)) factory.setBatchMode(next)
              }}
            >
              {VLM_MODE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  variant="outline"
                  disabled={factory.isRecognizing}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vlm-batch-prompt">提示词（可选）</Label>
            <Textarea
              id="vlm-batch-prompt"
              value={factory.batchPrompt}
              onChange={(event) => factory.setBatchPrompt(event.target.value)}
              placeholder="整批共用，留空则使用后端默认提示词"
              disabled={factory.isRecognizing}
              rows={3}
            />
          </div>

          <Button
            className="w-fit"
            data-icon="inline-start"
            disabled={!factory.canRecognize || factory.isRecognizing}
            onClick={factory.recognize}
          >
            {factory.isRecognizing ? <Loader2 className="animate-spin" /> : <ScanEye />}
            {factory.isRecognizing ? '识别中…' : hasResult ? '重新识别' : '开始识别'}
          </Button>
        </div>

        {factory.batchStatus === 'pending' ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.batchQueuePosition ?? '-'} 位
              {factory.batchQueueDepth > 0
                ? ` · 前方 ${factory.batchWaitingAhead} 个任务`
                : ''}
            </span>
          </div>
        ) : null}

        {factory.batchStatus === 'running' ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.batchStageLabel || '识别中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.batchStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>识别失败</AlertTitle>
            <AlertDescription>{factory.batchError || '请稍后重试。'}</AlertDescription>
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
                (batchItemsByScene.get(scene.index)?.length ?? 0) > 0,
              renderExpanded,
            }}
            emptyTitle="暂无场景"
            emptyDescription="请先完成场景切分与抽帧。"
          />
        </div>
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={!hasResult}
        />
      </CardFooter>
    </Card>
  )
}
