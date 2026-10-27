import { Download, Eye, Play, Subtitles, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  cancelSubtitleTask,
  getSubtitleSrtText,
  getSubtitleTaskDetail,
  getSubtitleTaskList,
  subtitleQueryKeys,
} from '@/api/subtitle'
import { ConfirmPopover } from '@/components/ConfirmPopover'
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
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type { SubtitleTask, SubtitleTaskStatus } from '@/types/subtitle'
import { formatDateTime, formatDuration } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { parseSrt } from '@/utils/srt'

/** 状态下拉「全部」哨兵值，避免与真实状态值冲突 */
const ALL_STATUS = 'all'

/** 状态展示顺序 */
const STATUS_OPTIONS: SubtitleTaskStatus[] = ['pending', 'running', 'success', 'failed']

const STATUS_META: Record<
  SubtitleTaskStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '合成中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/** 语言展示文案：未知值回退原文 */
const LANGUAGE_LABEL: Record<string, string> = {
  autodialect: '自动识别',
}

/** 来源展示文案：未知值回退原文 */
const SOURCE_TYPE_LABEL: Record<string, string> = {
  fileId: '素材库',
  upload: '本地上传',
}

/** 识别后端展示文案：未知值回退原文 */
const PROVIDER_LABEL: Record<string, string> = {
  xunfei: '讯飞',
}

/** 状态徽标：未知状态回退为原文 */
function renderStatusBadge(status: SubtitleTaskStatus) {
  const meta = STATUS_META[status]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 仅成功态有产物字幕 */
function hasSrt(record: SubtitleTask): boolean {
  return record.status === 'success' && Boolean(record.srtUrl)
}

/** 组装详情弹框字段：来自详情接口的最新快照 */
function buildDetailFields(
  record: SubtitleTask,
  handlers: { onPreviewSrt: (record: SubtitleTask) => void },
): DetailField[] {
  const audioUrl = resolveMediaUrl(record.audioUrl)
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
      id: 'language',
      label: '语言',
      value: LANGUAGE_LABEL[record.language] ?? (record.language || '--'),
    },
    {
      id: 'provider',
      label: '识别后端',
      value: PROVIDER_LABEL[record.provider] ?? (record.provider || '--'),
    },
    { id: 'progress', label: '进度', value: `${Math.round((record.progress ?? 0) * 100)}%` },
    { id: 'stage', label: '阶段', value: record.stageLabel || record.stage || '--' },
    {
      id: 'audioFileId',
      label: '音频文件 ID',
      value: record.audioFileId ? <CopyableCode value={record.audioFileId} /> : '--',
    },
    {
      id: 'cueCount',
      label: '字幕条数',
      value: record.status === 'success' ? String(record.cueCount ?? 0) : '--',
    },
    {
      id: 'audioDuration',
      label: '音频时长',
      value: record.status === 'success' ? formatDuration(record.audioDuration) : '--',
    },
    {
      id: 'audioUrl',
      label: '音频',
      value: audioUrl ? (
        <MediaPreview src={audioUrl} type="audio" title={record.originalName || '音频'}>
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Play />
            试听
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    {
      id: 'srtFileId',
      label: '字幕文件 ID',
      value: record.srtFileId ? <CopyableCode value={record.srtFileId} /> : '--',
    },
    {
      id: 'srtUrl',
      label: '字幕',
      value: hasSrt(record) ? (
        <Button
          variant="outline"
          size="sm"
          data-icon="inline-start"
          onClick={() => handlers.onPreviewSrt(record)}
        >
          <Subtitles />
          预览字幕
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

/** 组装表格列：字幕预览/详情需引用组件内的弹框回调 */
function buildColumns(handlers: {
  onPreviewSrt: (row: SubtitleTask) => void
  onViewDetail: (row: SubtitleTask) => void
  onCancel: (row: SubtitleTask) => void
  cancelingId: string | null
}): DataTableColumn<SubtitleTask>[] {
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
      key: 'language',
      title: '语言',
      render: (row) => LANGUAGE_LABEL[row.language] ?? (row.language || '--'),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'cueCount',
      title: '字幕条数',
      className: 'tabular-nums',
      render: (row) => (row.status === 'success' ? String(row.cueCount ?? 0) : '--'),
    },
    {
      key: 'audioDuration',
      title: '时长',
      className: 'tabular-nums',
      render: (row) => (row.status === 'success' ? formatDuration(row.audioDuration) : '--'),
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
      render: (row) => {
        const audioUrl = resolveMediaUrl(row.audioUrl)
        const srtUrl = resolveMediaUrl(row.srtUrl)
        const srtReady = hasSrt(row)
        return (
          <div className="flex justify-end gap-1">
            {audioUrl && (
              <MediaPreview src={audioUrl} type="audio" title={row.originalName || '音频'}>
                <Button variant="ghost" size="icon" aria-label="试听音频">
                  <Play />
                </Button>
              </MediaPreview>
            )}
            {srtReady && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="预览字幕"
                onClick={() => handlers.onPreviewSrt(row)}
              >
                <Subtitles />
              </Button>
            )}
            {srtReady && srtUrl && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="下载字幕"
                render={<a href={srtUrl} download />}
              >
                <Download />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="查看详情"
              onClick={() => handlers.onViewDetail(row)}
            >
              <Eye />
            </Button>
            {row.status === 'pending' && (
              <ConfirmPopover
                title="确认取消"
                description="取消后该任务将从队列移除且不可恢复，确认取消？"
                confirmText="确认取消"
                confirmLoading={handlers.cancelingId === row.id}
                onConfirm={() => handlers.onCancel(row)}
              >
                <X />
              </ConfirmPopover>
            )}
          </div>
        )
      },
    },
  ]
}

export function SubtitleRecordPage() {
  // null = 全部，切换时写回真实状态；查询键含 status，变化即自动重新请求
  const [status, setStatus] = useState<SubtitleTaskStatus | null>(null)
  // 详情弹框：非空即打开，同时作为详情接口的查询 id
  const [detailId, setDetailId] = useState<string | null>(null)
  // 字幕预览弹框：非空即打开，其 srtUrl 作为文本请求地址
  const [srtRecord, setSrtRecord] = useState<SubtitleTask | null>(null)

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
  } = usePaginationQuery<SubtitleTask>({
    queryKey: [...subtitleQueryKeys.tasks, status],
    queryFn: ({ page, pageSize }) =>
      getSubtitleTaskList({
        page,
        limit: pageSize,
        ...(status ? { status } : {}), // 全部时不传 status
      }),
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const handleStatusChange = (value: string | null) => {
    setStatus(value === null || value === ALL_STATUS ? null : (value as SubtitleTaskStatus))
    setPage(1)
  }

  const handlePreviewSrt = useCallback((row: SubtitleTask) => {
    setSrtRecord(row)
  }, [])

  const handleSrtOpenChange = useCallback((open: boolean) => {
    if (!open) setSrtRecord(null)
  }, [])

  const handleViewDetail = useCallback((row: SubtitleTask) => {
    setDetailId(row.id)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailId(null)
  }, [])

  // 详情数据仅在打开弹框时按 id 拉取；失败提示由弹框内展示，无需全局 toast
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: subtitleQueryKeys.taskDetail(detailId ?? ''),
    queryFn: () => {
      if (!detailId) throw new Error('缺少任务 ID')
      return getSubtitleTaskDetail(detailId)
    },
    enabled: Boolean(detailId),
  })

  // 字幕文本按需拉取，仅在打开预览弹框时请求
  const {
    data: srtText,
    isLoading: isSrtLoading,
    error: srtError,
  } = useQuery({
    queryKey: subtitleQueryKeys.srtText(srtRecord?.id ?? ''),
    queryFn: () => {
      if (!srtRecord?.srtUrl) throw new Error('缺少字幕地址')
      return getSubtitleSrtText(srtRecord.srtUrl)
    },
    enabled: Boolean(srtRecord),
  })

  const srtCues = useMemo(() => (srtText ? parseSrt(srtText) : []), [srtText])

  const detailFields = useMemo(
    () => (detail ? buildDetailFields(detail, { onPreviewSrt: handlePreviewSrt }) : []),
    [detail, handlePreviewSrt],
  )

  const cancelMutation = useMutation({ mutationFn: cancelSubtitleTask })

  // 仅正在取消的那一行显示 loading
  const cancelingId = cancelMutation.isPending ? (cancelMutation.variables ?? null) : null

  const handleCancel = useCallback(
    async (row: SubtitleTask) => {
      try {
        await cancelMutation.mutateAsync(row.id)
        await refetch()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [cancelMutation, refetch],
  )

  const columns = useMemo(
    () =>
      buildColumns({
        onPreviewSrt: handlePreviewSrt,
        onViewDetail: handleViewDetail,
        onCancel: handleCancel,
        cancelingId,
      }),
    [handlePreviewSrt, handleViewDetail, handleCancel, cancelingId],
  )

  // 字幕预览弹框内容：加载骨架 → 失败内联提示 → 解析出的字幕条目 → 回退原文
  let srtBody: ReactNode
  if (isSrtLoading) {
    srtBody = (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    )
  } else if (srtError) {
    srtBody = (
      <p className="py-8 text-center text-sm text-destructive">
        {srtError.message || '加载字幕失败，请稍后重试'}
      </p>
    )
  } else if (srtCues.length > 0) {
    srtBody = (
      <ol className="flex flex-col gap-3">
        {srtCues.map((cue) => (
          <li key={`${cue.index}-${cue.time}`} className="flex flex-col gap-0.5">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {cue.time}
            </span>
            <span className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {cue.text || '--'}
            </span>
          </li>
        ))}
      </ol>
    )
  } else {
    srtBody = (
      <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {srtText ?? ''}
      </pre>
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
                  : (STATUS_META[value as SubtitleTaskStatus]?.label ?? String(value))
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
        emptyTitle="暂无字幕合成记录"
        emptyDescription="发起字幕合成后，可在此查看记录、试听音频与预览字幕。"
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
        title="字幕合成任务详情"
        description={detailId ? `任务 ${detailId}` : undefined}
        loading={isDetailLoading}
        error={detailError}
        fields={detailFields}
      />

      <Dialog open={Boolean(srtRecord)} onOpenChange={handleSrtOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle>字幕预览</DialogTitle>
            <DialogDescription>
              {srtRecord ? (
                <>
                  {srtRecord.originalName || srtRecord.id}
                  {srtRecord.cueCount ? ` · 共 ${srtRecord.cueCount} 条` : ''}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto px-1 pb-1">{srtBody}</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
