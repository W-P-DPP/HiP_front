import { Eye, Play, Rows3, SquareArrowOutUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  getSceneSplitTaskDetail,
  getSceneSplitTaskList,
  sceneSplitQueryKeys,
} from '@/api/scene-split'
import { CopyableCode } from '@/components/CopyableCode'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { DetailDialog } from '@/components/DetailDialog'
import type { DetailField } from '@/components/DetailDialog'
import { MediaPreview } from '@/components/MediaPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type {
  SceneSplitScene,
  SceneSplitTask,
  SceneSplitTaskStatus,
} from '@/types/scene-split'
import { formatClockMs, formatDateTime, formatDurationMs } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { buildSceneProcessSeed } from '@/utils/workbench'

/** 状态下拉「全部」哨兵值，避免与真实状态值冲突 */
const ALL_STATUS = 'all'

/** 场景表每页条数（scenes 一次返回，本地切片渲染，避免一次性铺满 DOM） */
const SCENE_PAGE_SIZE = 20

/** 状态展示顺序 */
const STATUS_OPTIONS: SceneSplitTaskStatus[] = ['pending', 'running', 'success', 'failed']

const STATUS_META: Record<
  SceneSplitTaskStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '切分中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/** 来源展示文案：未知值回退原文 */
const SOURCE_TYPE_LABEL: Record<string, string> = {
  fileId: '素材库',
  upload: '本地上传',
}

/** 状态徽标：未知状态回退为原文 */
function renderStatusBadge(status: SceneSplitTaskStatus) {
  const meta = STATUS_META[status]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 仅成功态有场景产物 */
function hasScenes(record: SceneSplitTask): boolean {
  return record.status === 'success' && record.sceneCount > 0
}

/** 下游异步任务状态文案：与切分状态同构，但运行中统一称「处理中」 */
const DOWNSTREAM_STATUS_META: Record<
  'pending' | 'running' | 'success' | 'failed',
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '处理中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/** 下游任务状态徽标：未知状态回退为原文 */
function renderDownstreamStatusBadge(status: string) {
  const meta = DOWNSTREAM_STATUS_META[status as keyof typeof DOWNSTREAM_STATUS_META]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 下游任务概览项：任务 ID / 状态 / 阶段 / 关键计数（失败时附原因） */
interface DownstreamTaskSummary {
  id: string
  status: string
  stage: string
  metrics: string[]
  message?: string
}

/** 逐条展示下游异步任务概览：抽帧 / 转写 / 图像识别共用 */
function DownstreamTaskList({ tasks }: { tasks: DownstreamTaskSummary[] }) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-2.5"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {renderDownstreamStatusBadge(task.status)}
            <CopyableCode value={task.id} />
            {task.stage ? (
              <span className="text-xs text-muted-foreground">{task.stage}</span>
            ) : null}
          </div>
          {task.metrics.length > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {task.metrics.join(' · ')}
            </span>
          ) : null}
          {task.message ? <span className="text-xs text-destructive">{task.message}</span> : null}
        </div>
      ))}
    </div>
  )
}

/** 组装详情弹框字段：来自详情接口的最新快照 */
function buildDetailFields(
  record: SceneSplitTask,
  handlers: { onViewScenes: (record: SceneSplitTask) => void },
): DetailField[] {
  const videoUrl = resolveMediaUrl(record.sourceUrl)
  const fields: DetailField[] = [
    { id: 'id', label: '任务 ID', value: <CopyableCode value={record.id} /> },
    { id: 'status', label: '状态', value: renderStatusBadge(record.status) },
    {
      id: 'sourceType',
      label: '来源',
      value: SOURCE_TYPE_LABEL[record.sourceType] ?? (record.sourceType || '--'),
    },
    { id: 'originalName', label: '文件名', value: record.originalName || '--' },
    {
      id: 'sourceUrl',
      label: '源视频',
      value: videoUrl ? (
        <MediaPreview src={videoUrl} type="video" title={record.originalName || '源视频'}>
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Play />
            播放
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    { id: 'detector', label: '检测算法', value: record.detector || '--' },
    { id: 'threshold', label: '检测阈值', value: String(record.threshold) },
    { id: 'minSceneLenSec', label: '最短场景时长（秒）', value: String(record.minSceneLenSec) },
    { id: 'downscale', label: '降采样倍数', value: String(record.downscale) },
    { id: 'frameSkip', label: '隔帧采样数', value: String(record.frameSkip) },
    { id: 'blackDetectSec', label: '首尾黑帧检测（秒）', value: String(record.blackDetectSec) },
    { id: 'progress', label: '进度', value: `${Math.round((record.progress ?? 0) * 100)}%` },
    { id: 'stage', label: '阶段', value: record.stageLabel || record.stage || '--' },
    {
      id: 'sceneCount',
      label: '场景数',
      value: record.status === 'success' ? String(record.sceneCount) : '--',
    },
    {
      id: 'durationMs',
      label: '视频时长',
      value: record.durationMs > 0 ? formatDurationMs(record.durationMs) : '--',
    },
    {
      id: 'frameRate',
      label: '帧率',
      value: record.frameRate > 0 ? record.frameRate.toFixed(2) : '--',
    },
    {
      id: 'pySceneDetectVersion',
      label: 'pySceneDetect 版本',
      value: record.pySceneDetectVersion || '--',
    },
    {
      id: 'scenes',
      label: '场景列表',
      value: hasScenes(record) ? (
        <Button
          variant="outline"
          size="sm"
          data-icon="inline-start"
          onClick={() => handlers.onViewScenes(record)}
        >
          <Rows3 />
          查看场景
        </Button>
      ) : (
        '--'
      ),
    },
    {
      id: 'frameTasks',
      label: '抽帧任务',
      value: record.frameTasks.length ? (
        <DownstreamTaskList
          tasks={record.frameTasks.map((task) => ({
            id: task.id,
            status: task.status,
            stage: task.stageLabel || task.stage,
            metrics: [
              `${task.frameCount} 帧`,
              `${Math.round((task.progress ?? 0) * 100)}%`,
              task.durationMs > 0 ? formatDurationMs(task.durationMs) : '',
            ].filter(Boolean),
            message: task.message,
          }))}
        />
      ) : (
        '--'
      ),
      wide: true,
    },
    {
      id: 'asrTasks',
      label: '场景转写任务',
      value: record.asrTasks.length ? (
        <DownstreamTaskList
          tasks={record.asrTasks.map((task) => ({
            id: task.id,
            status: task.status,
            stage: task.stageLabel || task.stage,
            metrics: [
              task.provider,
              task.segmentCount > 0 ? `${task.segmentCount} 段` : '',
              `${Math.round((task.progress ?? 0) * 100)}%`,
              task.durationMs > 0 ? formatDurationMs(task.durationMs) : '',
            ].filter(Boolean),
            message: task.message,
          }))}
        />
      ) : (
        '--'
      ),
      wide: true,
    },
    {
      id: 'imageTasks',
      label: '图像识别任务',
      value: record.imageTasks.length ? (
        <DownstreamTaskList
          tasks={record.imageTasks.map((task) => ({
            id: task.id,
            status: task.status,
            stage: task.stageLabel || task.stage,
            metrics: [
              task.mode,
              `${Math.round((task.progress ?? 0) * 100)}%`,
              `成功 ${task.succeeded} · 失败 ${task.failed} · 共 ${task.total}`,
            ].filter(Boolean),
            message: task.message,
          }))}
        />
      ) : (
        '--'
      ),
      wide: true,
    },
    {
      id: 'startedAt',
      label: '开始时间',
      value: record.startedAt ? formatDateTime(record.startedAt) : '--',
    },
    {
      id: 'finishedAt',
      label: '结束时间',
      value: record.finishedAt ? formatDateTime(record.finishedAt) : '--',
    },
    { id: 'createdAt', label: '创建时间', value: formatDateTime(record.createdAt) },
    { id: 'updatedAt', label: '更新时间', value: formatDateTime(record.updatedAt) },
  ]
  if (record.message) {
    fields.push({
      id: 'message',
      label: record.status === 'failed' ? '失败原因' : '消息',
      value: record.message,
      wide: true,
    })
  }
  return fields
}

/** 组装表格列：查看详情/场景列表/前往工作台需引用组件内的回调 */
function buildColumns(handlers: {
  onViewDetail: (row: SceneSplitTask) => void
  onViewScenes: (row: SceneSplitTask) => void
  onOpenWorkbench: (row: SceneSplitTask) => void
}): DataTableColumn<SceneSplitTask>[] {
  return [
    {
      key: 'id',
      title: '任务 ID',
      render: (row) => <CopyableCode value={row.id} />,
    },
    {
      key: 'originalName',
      title: '文件名',
      width: 'max-w-64',
      render: (row) => (
        <span className="block truncate text-muted-foreground" title={row.originalName}>
          {row.originalName || '--'}
        </span>
      ),
    },
    {
      key: 'detector',
      title: '检测算法',
      render: (row) => row.detector || '--',
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'sceneCount',
      title: '场景数',
      className: 'tabular-nums',
      render: (row) => (row.status === 'success' ? String(row.sceneCount) : '--'),
    },
    {
      key: 'durationMs',
      title: '时长',
      className: 'tabular-nums',
      render: (row) => (row.durationMs > 0 ? formatDurationMs(row.durationMs) : '--'),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      className: 'tabular-nums',
      render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : ''),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="查看详情"
            onClick={() => handlers.onViewDetail(row)}
          >
            <Eye />
          </Button>
          {hasScenes(row) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="查看场景列表"
              onClick={() => handlers.onViewScenes(row)}
            >
              <Rows3 />
            </Button>
          )}
          {/* 排队中尚未执行，不提供入口；其余状态均可带参数跳回场景切分工作台 */}
          {row.status !== 'pending' && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="前往场景切分工作台"
                    onClick={() => handlers.onOpenWorkbench(row)}
                  >
                    <SquareArrowOutUpRight />
                  </Button>
                }
              />
              <TooltipContent>前往场景切分工作台</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]
}

export function SceneSplitRecordPage() {
  const navigate = useNavigate()
  // null = 全部，切换时写回真实状态；查询键含 status，变化即自动重新请求
  const [status, setStatus] = useState<SceneSplitTaskStatus | null>(null)
  // 详情弹框：非空即打开，同时作为详情接口的查询 id
  const [detailId, setDetailId] = useState<string | null>(null)
  // 场景列表弹框：非空即打开，同样以该记录 id 拉取详情（含 scenes）
  const [sceneRecord, setSceneRecord] = useState<SceneSplitTask | null>(null)
  const [scenePage, setScenePage] = useState(1)

  const {
    data,
    total,
    page,
    pageSize,
    isLoading,
    isFetching,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePaginationQuery<SceneSplitTask>({
    queryKey: [...sceneSplitQueryKeys.tasks, status],
    queryFn: ({ page, pageSize }) =>
      getSceneSplitTaskList({
        page,
        limit: pageSize,
        ...(status ? { status } : {}), // 全部时不传 status
      }),
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const handleStatusChange = (value: string | null) => {
    setStatus(value === null || value === ALL_STATUS ? null : (value as SceneSplitTaskStatus))
    setPage(1)
  }

  const handleViewDetail = useCallback((row: SceneSplitTask) => {
    setDetailId(row.id)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailId(null)
  }, [])

  const handleViewScenes = useCallback((row: SceneSplitTask) => {
    setSceneRecord(row)
    setScenePage(1)
  }, [])

  const handleScenesOpenChange = useCallback((open: boolean) => {
    if (!open) setSceneRecord(null)
  }, [])

  // 携带该记录跳回场景切分工作台：预载源视频与切分任务，进入即处于切分已完成状态
  const handleOpenWorkbench = useCallback(
    (row: SceneSplitTask) => {
      navigate('/work-room/scene-split', { state: { seed: buildSceneProcessSeed(row) } })
    },
    [navigate],
  )

  // 详情数据按 id 拉取，详情弹框与场景列表弹框共用同一查询（按 key 去重）
  const activeDetailId = detailId ?? sceneRecord?.id ?? null
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: sceneSplitQueryKeys.taskDetail(activeDetailId ?? ''),
    queryFn: () => {
      if (!activeDetailId) throw new Error('缺少任务 ID')
      return getSceneSplitTaskDetail(activeDetailId)
    },
    enabled: Boolean(activeDetailId),
  })

  const detailFields = useMemo(
    () => (detail ? buildDetailFields(detail, { onViewScenes: handleViewScenes }) : []),
    [detail, handleViewScenes],
  )

  const columns = useMemo(
    () =>
      buildColumns({
        onViewDetail: handleViewDetail,
        onViewScenes: handleViewScenes,
        onOpenWorkbench: handleOpenWorkbench,
      }),
    [handleViewDetail, handleViewScenes, handleOpenWorkbench],
  )

  // 场景表客户端分页（scenes 一次返回，本地切片）
  const scenes = useMemo(() => detail?.scenes ?? [], [detail])
  const totalScenePages = Math.max(1, Math.ceil(scenes.length / SCENE_PAGE_SIZE))
  const safeScenePage = Math.min(scenePage, totalScenePages)
  const pagedScenes = useMemo(() => {
    const start = (safeScenePage - 1) * SCENE_PAGE_SIZE
    return scenes.slice(start, start + SCENE_PAGE_SIZE)
  }, [scenes, safeScenePage])

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
    ],
    [],
  )

  // 场景列表弹框内容：加载骨架 → 失败内联提示 → 场景表
  let scenesBody: ReactNode
  if (isDetailLoading) {
    scenesBody = (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    )
  } else if (detailError) {
    scenesBody = (
      <p className="py-8 text-center text-sm text-destructive">
        {detailError.message || '加载场景失败，请稍后重试'}
      </p>
    )
  } else {
    scenesBody = (
      <DataTable
        columns={sceneColumns}
        data={pagedScenes}
        rowKey={(scene) => scene.index}
        emptyTitle="暂无场景"
        emptyDescription="未检测到可切分的场景边界。"
        pagination={{
          page: safeScenePage,
          pageSize: SCENE_PAGE_SIZE,
          total: scenes.length,
          onPageChange: setScenePage,
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status ?? ALL_STATUS} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value) =>
                value === ALL_STATUS
                  ? '全部'
                  : (STATUS_META[value as SceneSplitTaskStatus]?.label ?? String(value))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>全部</SelectItem>
            {STATUS_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_META[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        loading={isLoading}
        fetching={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="暂无场景切分记录"
        emptyDescription="发起场景切分任务后，可在此查看记录、场景明细，或跳回工作台继续后续步骤。"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      <DetailDialog
        open={Boolean(detailId)}
        onOpenChange={handleDetailOpenChange}
        title="场景切分任务详情"
        description={detailId ? `任务 ${detailId}` : undefined}
        loading={isDetailLoading}
        error={detailError}
        fields={detailFields}
      />

      <Dialog open={Boolean(sceneRecord)} onOpenChange={handleScenesOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle>场景列表</DialogTitle>
            <DialogDescription>
              {sceneRecord ? (
                <>
                  {sceneRecord.originalName || sceneRecord.id}
                  {sceneRecord.sceneCount ? ` · 共 ${sceneRecord.sceneCount} 个场景` : ''}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto px-1 pb-1">{scenesBody}</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
