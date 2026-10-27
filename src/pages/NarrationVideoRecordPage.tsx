import { Download, Eye } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  getNarrationVideoTaskDetail,
  getNarrationVideoTaskList,
  narrationVideoQueryKeys,
} from '@/api/narration-video'
import { CopyableCode } from '@/components/CopyableCode'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { DetailDialog } from '@/components/DetailDialog'
import type { DetailField } from '@/components/DetailDialog'
import { MediaPreview } from '@/components/MediaPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { VOICE_SPEED_MODES } from '@/constant/synthesis'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type {
  NarrationVideoTask,
  NarrationVideoTaskStatus,
} from '@/types/narration-video'
import { formatDateTime, formatDuration, formatDurationMs } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

/** 状态下拉「全部」哨兵值，避免与真实状态值冲突 */
const ALL_STATUS = 'all'

/** 状态展示顺序 */
const STATUS_OPTIONS: NarrationVideoTaskStatus[] = ['pending', 'running', 'success', 'failed']

const STATUS_META: Record<
  NarrationVideoTaskStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '合成中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/** 语速档位展示文案：未知值回退原文 */
const SPEED_MODE_LABEL: Record<string, string> = Object.fromEntries(
  VOICE_SPEED_MODES.map((mode) => [mode.value, mode.label]),
)

/** 状态徽标：未知状态回退为原文 */
function renderStatusBadge(status: NarrationVideoTaskStatus) {
  const meta = STATUS_META[status]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 组装详情弹框字段：来自详情接口的最新快照 */
function buildDetailFields(record: NarrationVideoTask): DetailField[] {
  const sourceUrl = resolveMediaUrl(record.sourceUrl)
  const videoUrl = resolveMediaUrl(record.videoUrl)
  const srtUrl = resolveMediaUrl(record.srtUrl)
  const fields: DetailField[] = [
    { id: 'id', label: '任务 ID', value: <CopyableCode value={record.id} /> },
    { id: 'status', label: '状态', value: renderStatusBadge(record.status) },
    { id: 'title', label: '标题', value: record.title || '--' },
    { id: 'summary', label: '总述', value: record.summary || '--', wide: true },
    { id: 'sourceOriginalName', label: '来源文件名', value: record.sourceOriginalName || '--' },
    {
      id: 'sourceUrl',
      label: '源视频',
      value: sourceUrl ? (
        <MediaPreview src={sourceUrl} type="video" title={record.sourceOriginalName || '源视频'}>
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Eye />
            播放
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    { id: 'sceneTaskId', label: '场景切分任务 ID', value: <CopyableCode value={record.sceneTaskId} /> },
    { id: 'voiceId', label: '音色 ID', value: <CopyableCode value={record.voiceId} /> },
    {
      id: 'speedMode',
      label: '语速档位',
      value: SPEED_MODE_LABEL[record.speedMode] ?? (record.speedMode || '--'),
    },
    { id: 'progress', label: '进度', value: `${Math.round((record.progress ?? 0) * 100)}%` },
    { id: 'stage', label: '阶段', value: record.stageLabel || record.stage || '--' },
    {
      id: 'segments',
      label: '分镜数',
      value: record.status === 'success' ? String(record.segments.length) : '--',
    },
    {
      id: 'segmentStates',
      label: '配音段数',
      value: record.status === 'success' ? String(record.segmentStates.length) : '--',
    },
    {
      id: 'cueCount',
      label: '字幕条数',
      value: record.status === 'success' ? String(record.cueCount) : '--',
    },
    {
      id: 'sourceDurationMs',
      label: '源视频时长',
      value: record.sourceDurationMs > 0 ? formatDurationMs(record.sourceDurationMs) : '--',
    },
    {
      id: 'videoDuration',
      label: '成品时长',
      value: record.videoDuration > 0 ? formatDuration(record.videoDuration) : '--',
    },
    {
      id: 'video',
      label: '成品视频',
      value: videoUrl ? (
        <MediaPreview src={videoUrl} type="video" title={record.title || '解说视频'}>
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Eye />
            播放
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    {
      id: 'srtUrl',
      label: '字幕文件',
      value: srtUrl ? (
        <Button
          variant="outline"
          size="sm"
          data-icon="inline-start"
          render={<a href={srtUrl} download />}
        >
          <Download />
          下载字幕
        </Button>
      ) : (
        '--'
      ),
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

/** 组装表格列：查看详情需引用组件内的回调 */
function buildColumns(handlers: {
  onViewDetail: (row: NarrationVideoTask) => void
}): DataTableColumn<NarrationVideoTask>[] {
  return [
    {
      key: 'id',
      title: '任务 ID',
      render: (row) => <CopyableCode value={row.id} />,
    },
    {
      key: 'title',
      title: '标题',
      width: 'max-w-64',
      render: (row) => (
        <span className="block truncate text-muted-foreground" title={row.title}>
          {row.title || '--'}
        </span>
      ),
    },
    {
      key: 'sourceOriginalName',
      title: '来源文件',
      width: 'max-w-48',
      render: (row) => (
        <span className="block truncate text-muted-foreground" title={row.sourceOriginalName}>
          {row.sourceOriginalName || '--'}
        </span>
      ),
    },
    {
      key: 'speedMode',
      title: '语速档位',
      render: (row) => SPEED_MODE_LABEL[row.speedMode] ?? (row.speedMode || '--'),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'progress',
      title: '进度',
      align: 'right',
      className: 'tabular-nums',
      render: (row) => `${Math.round((row.progress ?? 0) * 100)}%`,
    },
    {
      key: 'sourceDurationMs',
      title: '时长',
      align: 'right',
      className: 'tabular-nums',
      render: (row) => (row.sourceDurationMs > 0 ? formatDurationMs(row.sourceDurationMs) : '--'),
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
        </div>
      ),
    },
  ]
}

export function NarrationVideoRecordPage() {
  // null = 全部，切换时写回真实状态；查询键含 status，变化即自动重新请求
  const [status, setStatus] = useState<NarrationVideoTaskStatus | null>(null)
  // 详情弹框：非空即打开，同时作为详情接口的查询 id
  const [detailId, setDetailId] = useState<string | null>(null)

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
  } = usePaginationQuery<NarrationVideoTask>({
    queryKey: [...narrationVideoQueryKeys.tasks, status],
    queryFn: ({ page, pageSize }) =>
      getNarrationVideoTaskList({
        page,
        limit: pageSize,
        ...(status ? { status } : {}), // 全部时不传 status
      }),
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const handleStatusChange = (value: string | null) => {
    setStatus(value === null || value === ALL_STATUS ? null : (value as NarrationVideoTaskStatus))
    setPage(1)
  }

  const handleViewDetail = useCallback((row: NarrationVideoTask) => {
    setDetailId(row.id)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailId(null)
  }, [])

  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: narrationVideoQueryKeys.taskDetail(detailId ?? ''),
    queryFn: () => {
      if (!detailId) throw new Error('缺少任务 ID')
      return getNarrationVideoTaskDetail(detailId)
    },
    enabled: Boolean(detailId),
  })

  const detailFields = useMemo(() => (detail ? buildDetailFields(detail) : []), [detail])

  const columns = useMemo(
    () => buildColumns({ onViewDetail: handleViewDetail }),
    [handleViewDetail],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status ?? ALL_STATUS} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value) =>
                value === ALL_STATUS
                  ? '全部'
                  : (STATUS_META[value as NarrationVideoTaskStatus]?.label ?? String(value))
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
        emptyTitle="暂无视频解说记录"
        emptyDescription="在场景切分工作台的「解说生成」完成后进入「视频解说」提交任务，可在此查看记录、成品视频与字幕。"
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
        title="视频解说任务详情"
        description={detailId ? `任务 ${detailId}` : undefined}
        loading={isDetailLoading}
        error={detailError}
        fields={detailFields}
      />
    </div>
  )
}
