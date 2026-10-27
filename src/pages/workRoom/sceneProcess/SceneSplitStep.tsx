import { Clapperboard, Film, GitMerge, Loader2, Play, Scissors, TriangleAlert } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'

import { mergeScenes } from '@/api/scene-split'
import { AppDialog } from '@/components/AppDialog'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { MaterialPickerDialog } from '@/components/MaterialPickerDialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DETECTOR_OPTIONS, NUMERIC_FIELDS } from '@/constant/scene-process'
import { cn } from '@/lib/utils'
import type { SceneSplitScene } from '@/types/scene-split'
import type { VideoMaterial } from '@/types/video-material'
import { formatBytes, formatClockMs, formatDurationMs } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { message } from '@/utils/message'
import { isContiguous } from '@/utils/scene-split'
import { StepFooter } from '../stages/StepFooter'
import type { SceneSplitStageController } from './controller'

/** 场景表默认每页条数（上千场景时分页渲染，避免一次性铺满 DOM） */
const SCENE_PAGE_SIZE = 20

interface SceneSplitStepProps {
  factory: SceneSplitStageController
}

/**
 * 步骤 · 场景切分：仅从素材库选择视频素材（不可本地上传），可选配置检测参数后提交切分任务，
 * 轮询排队位置与进度，成功后以分页表格展示场景，点击场景行可定位到视频对应时间点。
 */
export function SceneSplitStep({ factory }: SceneSplitStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  // 场景表客户端分页（scenes 一次返回，本地切片）
  const [scenePage, setScenePage] = useState(1)
  const [scenePageSize, setScenePageSize] = useState(SCENE_PAGE_SIZE)
  // 点击场景行后高亮的场景序号，同时用于视频定位
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null)
  // 已勾选待合并的场景序号（必须连续）
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { material, sceneSplitTask: task, scenes } = factory

  // 合并后场景数减少，当前页可能越界：把展示页码钳到合法范围（派生而非 effect 同步，避免级联渲染）
  const totalScenePages = Math.max(1, Math.ceil(scenes.length / scenePageSize))
  const safeScenePage = Math.min(scenePage, totalScenePages)

  // 场景表当前页切片：scenes 全量在内存，翻页只切数组
  const pagedScenes = useMemo(() => {
    const start = (safeScenePage - 1) * scenePageSize
    return scenes.slice(start, start + scenePageSize)
  }, [scenes, safeScenePage, scenePageSize])

  // 已选序号与当前场景求交：合并后序号会被后端重排，避免残留失效序号进入入参（用派生值，不写回 state）
  const validSelectedIndices = useMemo(() => {
    const available = new Set(scenes.map((scene) => scene.index))
    return selectedIndices.filter((index) => available.has(index))
  }, [scenes, selectedIndices])

  const selectedIndexSet = useMemo(
    () => new Set<string | number>(validSelectedIndices),
    [validSelectedIndices],
  )

  // 选中场景（scenes 本身按序号升序返回，过滤后即为升序）
  const selectedScenes = useMemo(
    () => scenes.filter((scene) => selectedIndexSet.has(scene.index)),
    [scenes, selectedIndexSet],
  )
  const selectedCount = selectedScenes.length

  // 合并后区间预览：取选中段的首尾
  const mergePreview = useMemo(() => {
    const first = selectedScenes[0]
    const last = selectedScenes[selectedScenes.length - 1]
    if (!first || !last) return null
    return {
      from: first.index,
      to: last.index,
      startMs: first.startMs,
      endMs: last.endMs,
      durationMs: last.endMs - first.startMs,
    }
  }, [selectedScenes])

  const { refreshTask } = factory

  const mergeMutation = useMutation({
    mutationFn: (groups: number[][]) => {
      if (!task) throw new Error('缺少任务信息')
      return mergeScenes(task.id, { groups })
    },
  })

  // 视频地址优先用任务里的源地址（后端已按 fileId 给出下载地址），未提交时用素材自身地址
  const videoUrl = resolveMediaUrl(task?.sourceUrl || material?.file.url || '')

  const handlePickMaterial = useCallback(
    (materials: VideoMaterial[]) => {
      const picked = materials[0]
      if (!picked) return
      factory.setMaterial(picked)
      setActiveSceneIndex(null)
      setSelectedIndices([])
    },
    [factory],
  )

  // 点击操作列的「定位」：把视频跳到该场景起点，并记录已定位的场景
  const handleSeekScene = useCallback((scene: SceneSplitScene) => {
    const video = videoRef.current
    if (video) video.currentTime = scene.startMs / 1000
    setActiveSceneIndex(scene.index)
  }, [])

  // 列配置内联在组件里（而非抽成模块级构造函数）：定位回调需要读 videoRef，
  // 把读 ref 的回调当参数传给普通函数会触发 react-hooks/refs 告警。
  // 定位放操作列：整行点击已用于勾选/取消选择，故把视频定位挪出行的点击区。
  const sceneColumns = useMemo<DataTableColumn<SceneSplitScene>[]>(
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
        key: 'actions',
        title: '操作',
        align: 'right',
        render: (scene) => (
          <Button
            variant={scene.index === activeSceneIndex ? 'secondary' : 'ghost'}
            size="sm"
            data-icon="inline-start"
            onClick={(event) => {
              // 阻止冒泡：点「定位」不应触发整行的勾选
              event.stopPropagation()
              handleSeekScene(scene)
            }}
          >
            <Play />
            定位
          </Button>
        ),
      },
    ],
    [handleSeekScene, activeSceneIndex],
  )

  // 勾选/取消勾选单个场景；连续性校验放在 state updater 之外（updater 内不能有副作用，
  // StrictMode 下会重复执行导致重复提示）
  const handleToggleScene = useCallback(
    (scene: SceneSplitScene) => {
      const next = validSelectedIndices.includes(scene.index)
        ? validSelectedIndices.filter((index) => index !== scene.index)
        : [...validSelectedIndices, scene.index]
      if (!isContiguous(next)) {
        message.warning('只能选择连续的场景行，请先取消已选或清空选择')
        return
      }
      setSelectedIndices(next)
    },
    [validSelectedIndices],
  )

  // 全选/取消当前页；本页序号并入后若与已选范围不连续则拒绝
  const handleToggleAllScenes = useCallback(
    (records: SceneSplitScene[]) => {
      const pageIndices = records.map((scene) => scene.index)
      const isPageSelected = pageIndices.every((index) =>
        validSelectedIndices.includes(index),
      )
      const next = isPageSelected
        ? validSelectedIndices.filter((index) => !pageIndices.includes(index))
        : [...validSelectedIndices, ...pageIndices]
      if (!isContiguous(next)) {
        message.warning('本页场景与已选范围不连续，无法一起合并')
        return
      }
      setSelectedIndices(next)
    },
    [validSelectedIndices],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedIndices([])
  }, [])

  const handleMerge = useCallback(async () => {
    const sorted = [...validSelectedIndices].sort((a, b) => a - b)
    if (sorted.length < 2) return
    try {
      // 连续性已在校验时保证，一段连续序号即一个分组
      await mergeMutation.mutateAsync([sorted])
      setMergeConfirmOpen(false)
      setSelectedIndices([])
      setActiveSceneIndex(null)
      // 合并后序号会被后端重排，重新拉任务详情刷新场景表
      refreshTask()
    } catch {
      // 失败提示已由 axios 拦截器统一处理（弹框保持打开便于重试）
    }
  }, [validSelectedIndices, mergeMutation, refreshTask])

  // 重新提交前重置场景表页码、高亮与已选，避免沿用上一轮的浏览位置
  const handleSplit = () => {
    setScenePage(1)
    setActiveSceneIndex(null)
    setSelectedIndices([])
    setMergeConfirmOpen(false)
    factory.split()
  }

  const percent = Math.round(factory.splitProgress * 100)

  let resultContent: ReactNode
  if (factory.isSplitting) {
    resultContent = (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  } else if (factory.splitStatus === 'success' && task) {
    resultContent = (
      <div className="flex flex-col gap-4">
        <div className="grid gap-x-6 gap-y-1 xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground sm:grid-cols-3">
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
          <span>检测算法：{task.detector || '—'}</span>
          <span>检测阈值：{task.threshold}</span>
          <span>pySceneDetect：{task.pySceneDetectVersion || '—'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl border border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm">
            {mergePreview ? (
              <>
                已选{' '}
                <span className="text-foreground tabular-nums">{selectedCount}</span> 个连续场景（序号{' '}
                <span className="text-foreground tabular-nums">{mergePreview.from}</span> –{' '}
                <span className="text-foreground tabular-nums">{mergePreview.to}</span>）
              </>
            ) : (
              <span className="text-muted-foreground">
                点击行即可选择场景（仅支持序号连续的行），选中 2 个以上可合并。
              </span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedCount === 0}
              onClick={handleClearSelection}
            >
              清空选择
            </Button>
            <Button
              size="sm"
              data-icon="inline-start"
              disabled={selectedCount < 2}
              onClick={() => setMergeConfirmOpen(true)}
            >
              <GitMerge />
              合并场景
            </Button>
          </div>
        </div>

        <DataTable
          columns={sceneColumns}
          data={pagedScenes}
          rowKey={(scene) => scene.index}
          /* 点击整行即勾选/取消选中（与本项目素材选择弹框一致）；视频定位改由操作列按钮承担 */
          onRowClick={handleToggleScene}
          selection={{
            selectedKeys: selectedIndexSet,
            onToggleRow: handleToggleScene,
            onToggleAll: handleToggleAllScenes,
            rowLabel: (scene) => `序号 ${scene.index}`,
          }}
          emptyTitle="暂无场景"
          emptyDescription="未检测到可切分的场景边界。"
          pagination={{
            page: safeScenePage,
            pageSize: scenePageSize,
            total: scenes.length,
            onPageChange: setScenePage,
            onPageSizeChange: (size) => {
              setScenePageSize(size)
              setScenePage(1)
            },
          }}
        />
      </div>
    )
  } else if (factory.splitStatus === 'failed') {
    resultContent = null
  } else if (material) {
    resultContent = (
      <p className="text-sm text-muted-foreground">尚未开始切分，点击上方按钮开始。</p>
    )
  } else {
    resultContent = <p className="text-sm text-muted-foreground">请先从素材库选择视频。</p>
  }

  return (
    <Card className="shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>场景切分</CardTitle>
        <CardDescription>
          从素材库选择视频，自动检测场景边界并按时间轴切分，完成后可逐场景定位预览，也可选中连续场景合并。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>视频素材</Label>
            <Button
              variant="outline"
              className="w-fit"
              data-icon="inline-start"
              disabled={factory.isSplitting}
              onClick={() => setPickerOpen(true)}
            >
              <Clapperboard />
              {material ? '重新选择视频' : '从素材库选择'}
            </Button>
            <p className="text-xs text-muted-foreground">
              仅支持从素材库选择视频素材，单选。
            </p>
          </div>

          {material ? (
            <div className="flex flex-col gap-3 xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <Film className="size-4" />
                </span>
                <span className="truncate text-sm font-medium">
                  {material.fileName || material.keyword}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  已选择
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {material.fileName} · {formatBytes(material.file?.size ?? 0)}
              </span>
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-80 w-full rounded-lg bg-black object-contain"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">高级参数（可选）</span>
            <span className="text-xs text-muted-foreground">
              留空或选择「默认」时，使用后端为该算法准备的推荐值。
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>检测算法</Label>
            <ToggleGroup
              value={[factory.detector]}
              onValueChange={(value) => factory.setDetector(value[0] ?? 'default')}
            >
              {DETECTOR_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  variant="outline"
                  disabled={factory.isSplitting}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NUMERIC_FIELDS.map((field) => {
              const isInvalid = factory.invalidFieldKeys.includes(field.key)
              return (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`scene-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`scene-${field.key}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="后端默认"
                    value={factory.numericValues[field.key]}
                    aria-invalid={isInvalid || undefined}
                    disabled={factory.isSplitting}
                    onChange={(event) =>
                      factory.setNumericValue(field.key, event.target.value)
                    }
                  />
                  <p
                    className={cn(
                      'text-xs',
                      isInvalid ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {isInvalid ? '请输入不小于 0 的数字' : field.hint}
                  </p>
                </div>
              )
            })}
          </div>

          <Button
            className="w-fit"
            data-icon="inline-start"
            disabled={!material || factory.isSplitting || factory.hasInvalidParams}
            onClick={handleSplit}
          >
            {factory.isSplitting ? <Loader2 className="animate-spin" /> : <Scissors />}
            {factory.isSplitting ? '切分中…' : '开始切分'}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {factory.splitStatus === 'pending' ? (
            <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-sm">
                排队中 · 当前第 {factory.splitQueuePosition ?? '-'} 位
                {factory.splitQueueDepth > 0
                  ? ` · 前方 ${factory.splitWaitingAhead} 个任务`
                  : ''}
              </span>
            </div>
          ) : null}

          {factory.splitStatus === 'running' ? (
            <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                <span>{factory.splitStageLabel || '切分中'}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
              </div>
              <Progress value={percent} />
            </div>
          ) : null}

          {factory.splitStatus === 'failed' ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>切分失败</AlertTitle>
              <AlertDescription>{factory.splitError || '请稍后重试。'}</AlertDescription>
            </Alert>
          ) : null}

          {resultContent}
        </div>
      </CardContent>
      <CardFooter>
        <StepFooter onNext={factory.goNext} nextDisabled={!factory.isSceneSplitDone} />
      </CardFooter>

      <MaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        maxCount={1}
        mediaType="video"
        title="选择视频素材"
        description="仅展示视频素材，单选。"
        onConfirm={handlePickMaterial}
      />

      {/* 合并不可撤销，执行前二次确认 */}
      <AppDialog
        open={mergeConfirmOpen}
        onOpenChange={setMergeConfirmOpen}
        title="确认合并场景"
        description="合并后不可撤销，请确认要合并的场景范围。"
        footer={
          <>
            <Button variant="outline" onClick={() => setMergeConfirmOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              data-icon="inline-start"
              disabled={mergeMutation.isPending}
              onClick={handleMerge}
            >
              {mergeMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <GitMerge />
              )}
              确认合并
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 px-2.5 py-1">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>合并后不可撤销</AlertTitle>
            <AlertDescription>
              已合并的场景无法拆分还原，请确认无误后再执行。
            </AlertDescription>
          </Alert>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">序号范围</dt>
            <dd className="tabular-nums">
              {mergePreview ? `${mergePreview.from} – ${mergePreview.to}` : '—'}
            </dd>
            <dt className="text-muted-foreground">合并场景数</dt>
            <dd className="tabular-nums">{selectedCount}</dd>
            <dt className="text-muted-foreground">合并后区间</dt>
            <dd className="tabular-nums">
              {mergePreview
                ? `${formatClockMs(mergePreview.startMs)} – ${formatClockMs(mergePreview.endMs)}`
                : '—'}
            </dd>
            <dt className="text-muted-foreground">合并后时长</dt>
            <dd className="tabular-nums">
              {mergePreview ? formatClockMs(mergePreview.durationMs) : '—'}
            </dd>
          </dl>
        </div>
      </AppDialog>
    </Card>
  )
}
