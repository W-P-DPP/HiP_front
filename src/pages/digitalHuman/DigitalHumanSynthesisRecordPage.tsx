import { Download, Eye, FileText, Play, SquareArrowOutUpRight, Subtitles, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  cancelDigitalHumanTask,
  digitalHumanQueryKeys,
  getDigitalHumanTaskDetail,
  getDigitalHumanTaskList,
} from '@/api/digital-human'
import { getSubtitleSrtText } from '@/api/subtitle'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type {
  DigitalHumanSynthesisRecord,
  DigitalHumanSynthesisStatus,
} from '@/types/digital-human'
import { formatDateTime, formatDuration } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'
import { parseSrt } from '@/utils/srt'
import { buildDigitalHumanFactorySeed } from '@/utils/workbench'

/** 状态下拉「全部」哨兵值，避免与真实状态值冲突 */
const ALL_STATUS = 'all'

/** 状态展示顺序 */
const STATUS_OPTIONS: DigitalHumanSynthesisStatus[] = [
  'pending',
  'running',
  'success',
  'failed',
  'cancelled',
]

const STATUS_META: Record<
  DigitalHumanSynthesisStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '合成中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
}

/** 状态徽标：未知状态回退为原文 */
function renderStatusBadge(status: DigitalHumanSynthesisStatus) {
  const meta = STATUS_META[status]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 速度档位展示文案 */
const SPEED_MODE_LABEL: Record<string, string> = {
  fast: '快速',
  balanced: '均衡',
  quality: '高质量',
}

/** 组装详情弹框字段：来自详情接口的最新快照 */
function buildDetailFields(
  record: DigitalHumanSynthesisRecord,
  handlers: { onPreviewSrt: (record: DigitalHumanSynthesisRecord) => void },
): DetailField[] {
  const audioUrl = resolveMediaUrl(record.audioUrl)
  const videoUrl = resolveMediaUrl(record.resultUrl)
  const rawVideoUrl = resolveMediaUrl(record.rawVideoUrl)
  const fields: DetailField[] = [
    { id: 'id', label: '任务 ID', value: <CopyableCode value={record.id} /> },
    { id: 'status', label: '状态', value: renderStatusBadge(record.status) },
    { id: 'avatarId', label: '数字人 ID', value: <CopyableCode value={record.avatarId} /> },
    { id: 'voiceId', label: '音色 ID', value: <CopyableCode value={record.voiceId} /> },
    {
      id: 'speedMode',
      label: '速度档位',
      value: SPEED_MODE_LABEL[record.speedMode] ?? (record.speedMode || '--'),
    },
    { id: 'progress', label: '进度', value: `${Math.round((record.progress ?? 0) * 100)}%` },
    { id: 'stage', label: '阶段', value: record.stageLabel || record.stage || '--' },
    {
      id: 'audioDuration',
      label: '音频时长',
      value: record.status === 'success' ? formatDuration(record.audioDuration) : '--',
    },
    {
      id: 'videoDuration',
      label: '视频时长',
      value: record.status === 'success' ? formatDuration(record.videoDuration) : '--',
    },
    {
      id: 'burnSubtitles',
      label: '烧录字幕',
      value: record.burnSubtitles ? '是' : '否',
    },
    {
      id: 'cueCount',
      label: '字幕条数',
      value: record.burnSubtitles ? String(record.cueCount ?? 0) : '--',
    },
    {
      id: 'audioUrl',
      label: '合成音频',
      value: audioUrl ? (
        <MediaPreview src={audioUrl} type="audio" title="合成音频">
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
      id: 'resultUrl',
      label: '合成视频',
      value: videoUrl ? (
        <MediaPreview src={videoUrl} type="video" title="合成视频">
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Play />
            播放
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    {
      id: 'rawVideoUrl',
      label: '原视频（未烧录字幕）',
      value: rawVideoUrl ? (
        <MediaPreview src={rawVideoUrl} type="video" title="原视频">
          <Button variant="outline" size="sm" data-icon="inline-start">
            <Play />
            播放
          </Button>
        </MediaPreview>
      ) : (
        '--'
      ),
    },
    {
      id: 'subtitleTaskId',
      label: '字幕任务 ID',
      value: record.subtitleTaskId ? <CopyableCode value={record.subtitleTaskId} /> : '--',
    },
    {
      id: 'srtFileId',
      label: '字幕文件 ID',
      value: record.srtFileId ? <CopyableCode value={record.srtFileId} /> : '--',
    },
    {
      id: 'srtUrl',
      label: '字幕',
      value: record.srtUrl ? (
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
  fields.push({
    id: 'text',
    label: '合成文本',
    value: <span className="whitespace-pre-wrap leading-relaxed">{record.text || '--'}</span>,
    wide: true,
  })
  return fields
}

/** 组装表格列：查看文案/详情需引用组件内的弹框回调 */
function buildColumns(handlers: {
  onViewText: (row: DigitalHumanSynthesisRecord) => void
  onViewDetail: (row: DigitalHumanSynthesisRecord) => void
  onCancel: (row: DigitalHumanSynthesisRecord) => void
  onOpenWorkbench: (row: DigitalHumanSynthesisRecord) => void
  cancelingId: string | null
}): DataTableColumn<DigitalHumanSynthesisRecord>[] {
  return [
    {
      key: 'id',
      title: '任务 ID',
      render: (row) => <CopyableCode value={row.id} />,
    },
    // {
    //   key: 'avatarId',
    //   title: '数字人',
    //   render: (row) => <CopyableCode value={row.avatarId} />,
    // },
    // {
    //   key: 'voiceId',
    //   title: '音色',
    //   render: (row) => <CopyableCode value={row.voiceId} />,
    // },
    {
      key: 'text',
      title: '文本',
      width: 'max-w-64',
      render: (row) => (
        <span className="block truncate text-muted-foreground" title={row.text}>
          {row.text || '--'}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'duration',
      title: '时长',
      className: 'tabular-nums',
      render: (row) => (row.status === 'success' ? formatDuration(row.videoDuration) : '--'),
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
        // 仅成功态有成品视频；等待/运行/失败既无视频也不展示播放/下载
        const videoUrl = resolveMediaUrl(row.resultUrl)
        const hasResult = row.status === 'success' && Boolean(videoUrl)
        return (
          <div className="flex justify-end gap-1">
            {hasResult && (
              <MediaPreview src={videoUrl} type="video" title="合成视频">
                <Button variant="ghost" size="icon" aria-label="播放视频">
                  <Play />
                </Button>
              </MediaPreview>
            )}
            {hasResult && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="下载"
                render={<a href={videoUrl} download />}
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
            <Button
              variant="ghost"
              size="icon"
              aria-label="查看文案"
              onClick={() => handlers.onViewText(row)}
            >
              <FileText />
            </Button>
            {/* 排队中尚未执行，不提供入口；其余状态（合成中/已成功/已失败/已取消）均可带参数跳回数字人工厂 */}
            {row.status !== 'pending' && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="前往工作台重新合成"
                      onClick={() => handlers.onOpenWorkbench(row)}
                    >
                      <SquareArrowOutUpRight />
                    </Button>
                  }
                />
                <TooltipContent>前往工作台重新合成</TooltipContent>
              </Tooltip>
            )}
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

export function DigitalHumanSynthesisRecordPage() {
  const navigate = useNavigate()
  // null = 全部，切换时写回真实状态；查询键含 status，变化即自动重新请求
  const [status, setStatus] = useState<DigitalHumanSynthesisStatus | null>(null)
  // 文案查看弹框状态
  const [textRecord, setTextRecord] = useState<DigitalHumanSynthesisRecord | null>(null)
  // 详情弹框：非空即打开，同时作为详情接口的查询 id
  const [detailId, setDetailId] = useState<string | null>(null)
  // 字幕预览弹框：非空即打开，其 srtUrl 作为文本请求地址
  const [srtRecord, setSrtRecord] = useState<DigitalHumanSynthesisRecord | null>(null)

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
  } = usePaginationQuery<DigitalHumanSynthesisRecord>({
    queryKey: [...digitalHumanQueryKeys.tasks, status],
    queryFn: ({ page, pageSize }) =>
      getDigitalHumanTaskList({
        page,
        limit: pageSize,
        ...(status ? { status } : {}), // 全部时不传 status
      }),
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const handleStatusChange = (value: string | null) => {
    setStatus(
      value === null || value === ALL_STATUS ? null : (value as DigitalHumanSynthesisStatus),
    )
    setPage(1)
  }

  const handleViewText = useCallback((row: DigitalHumanSynthesisRecord) => {
    setTextRecord(row)
  }, [])

  const handleTextOpenChange = useCallback((open: boolean) => {
    if (!open) setTextRecord(null)
  }, [])

  const handleViewDetail = useCallback((row: DigitalHumanSynthesisRecord) => {
    setDetailId(row.id)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailId(null)
  }, [])

  const handlePreviewSrt = useCallback((record: DigitalHumanSynthesisRecord) => {
    setSrtRecord(record)
  }, [])

  const handleSrtOpenChange = useCallback((open: boolean) => {
    if (!open) setSrtRecord(null)
  }, [])

  // 详情数据仅在打开弹框时按 id 拉取；失败提示由弹框内展示，无需全局 toast
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: digitalHumanQueryKeys.taskDetail(detailId ?? ''),
    queryFn: () => {
      if (!detailId) throw new Error('缺少任务 ID')
      return getDigitalHumanTaskDetail(detailId)
    },
    enabled: Boolean(detailId),
  })

  const detailFields = useMemo(
    () => (detail ? buildDetailFields(detail, { onPreviewSrt: handlePreviewSrt }) : []),
    [detail, handlePreviewSrt],
  )

  // 字幕文本按需拉取，仅在打开预览弹框时请求
  const {
    data: srtText,
    isLoading: isSrtLoading,
    error: srtError,
  } = useQuery({
    queryKey: digitalHumanQueryKeys.srtText(srtRecord?.id ?? ''),
    queryFn: () => {
      if (!srtRecord?.srtUrl) throw new Error('缺少字幕地址')
      return getSubtitleSrtText(srtRecord.srtUrl)
    },
    enabled: Boolean(srtRecord),
  })

  const srtCues = useMemo(() => (srtText ? parseSrt(srtText) : []), [srtText])

  const cancelMutation = useMutation({ mutationFn: cancelDigitalHumanTask })

  // 仅正在取消的那一行显示 loading
  const cancelingId = cancelMutation.isPending ? (cancelMutation.variables ?? null) : null

  const handleCancel = useCallback(
    async (row: DigitalHumanSynthesisRecord) => {
      try {
        await cancelMutation.mutateAsync(row.id)
        await refetch()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [cancelMutation, refetch],
  )

  // 携带该记录文案/音色/形象与已有产物跳回数字人工厂，落到对应步骤直接重新合成
  const handleOpenWorkbench = useCallback(
    (row: DigitalHumanSynthesisRecord) => {
      navigate('/work-room/digital-human', { state: { seed: buildDigitalHumanFactorySeed(row) } })
    },
    [navigate],
  )

  const columns = useMemo(
    () =>
      buildColumns({
        onViewText: handleViewText,
        onViewDetail: handleViewDetail,
        onCancel: handleCancel,
        onOpenWorkbench: handleOpenWorkbench,
        cancelingId,
      }),
    [handleViewText, handleViewDetail, handleCancel, handleOpenWorkbench, cancelingId],
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
                  : (STATUS_META[value as DigitalHumanSynthesisStatus]?.label ?? String(value))
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
        emptyTitle="暂无数字人合成记录"
        emptyDescription="在数字人页发起视频合成后，可在此查看记录与成品。"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      <Dialog open={Boolean(textRecord)} onOpenChange={handleTextOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle>合成文案</DialogTitle>
            <DialogDescription>
              {textRecord ? (
                <>
                  任务 {textRecord.id}
                  {textRecord.status === 'failed' && textRecord.message
                    ? ` · 失败原因：${textRecord.message}`
                    : ''}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap px-1 pb-1 text-sm leading-relaxed text-foreground">
            {textRecord?.text ?? ''}
          </div>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={Boolean(detailId)}
        onOpenChange={handleDetailOpenChange}
        title="数字人合成任务详情"
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
                  任务 {srtRecord.id}
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
