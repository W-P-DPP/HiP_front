import { Download, Eye, FileText, Play, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  cancelVoiceTrainV2Synthesis,
  getVoiceTrainV2SynthesisList,
  getVoiceTrainV2SynthesisRecordDetail,
  voiceTrainV2QueryKeys,
} from '@/api/voice-train-v2'
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
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type {
  VoiceTrainV2SynthesisRecord,
  VoiceTrainV2SynthesisStatus,
} from '@/types/voice-train-v2'
import { formatDateTime, formatDuration } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

/** 状态下拉「全部」哨兵值，避免与真实状态值冲突 */
const ALL_STATUS = 'all'

/** 状态展示顺序 */
const STATUS_OPTIONS: VoiceTrainV2SynthesisStatus[] = [
  'pending',
  'running',
  'success',
  'failed',
]

const STATUS_META: Record<
  VoiceTrainV2SynthesisStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  pending: { label: '排队中', variant: 'outline' },
  running: { label: '合成中', variant: 'secondary' },
  success: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
}

/** 合成用途展示文案 */
const PURPOSE_LABEL: Record<string, string> = {
  preview: '试听',
  synthesis: '正式合成',
}

/** 速度档位展示文案 */
const SPEED_MODE_LABEL: Record<string, string> = {
  fast: '快速',
  balanced: '均衡',
  quality: '高质量',
}

/** 状态徽标：未知状态回退为原文 */
function renderStatusBadge(status: VoiceTrainV2SynthesisStatus) {
  const meta = STATUS_META[status]
  return meta ? (
    <Badge variant={meta.variant}>{meta.label}</Badge>
  ) : (
    <Badge variant="outline">{status}</Badge>
  )
}

/** 组装详情弹框字段：来自详情接口的最新快照 */
function buildDetailFields(record: VoiceTrainV2SynthesisRecord): DetailField[] {
  const audioUrl = resolveMediaUrl(record.resultUrl)
  const fields: DetailField[] = [
    { id: 'id', label: '任务 ID', value: <CopyableCode value={record.id} /> },
    { id: 'status', label: '状态', value: renderStatusBadge(record.status) },
    {
      id: 'purpose',
      label: '用途',
      value: PURPOSE_LABEL[record.purpose] ?? (record.purpose || '--'),
    },
    { id: 'voiceId', label: '音色 ID', value: <CopyableCode value={record.voiceId} /> },
    {
      id: 'speedMode',
      label: '速度档位',
      value: SPEED_MODE_LABEL[record.speedMode] ?? (record.speedMode || '--'),
    },
    { id: 'progress', label: '进度', value: `${Math.round((record.progress ?? 0) * 100)}%` },
    { id: 'stage', label: '阶段', value: record.stageLabel || record.stage || '--' },
    {
      id: 'duration',
      label: '音频时长',
      value: record.status === 'success' ? formatDuration(record.duration) : '--',
    },
    {
      id: 'resultUrl',
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
  onViewText: (row: VoiceTrainV2SynthesisRecord) => void
  onViewDetail: (row: VoiceTrainV2SynthesisRecord) => void
  onCancel: (row: VoiceTrainV2SynthesisRecord) => void
  cancelingId: string | null
}): DataTableColumn<VoiceTrainV2SynthesisRecord>[] {
  return [
    {
      key: 'id',
      title: '任务 ID',
      render: (row) => <CopyableCode value={row.id} />,
    },
    {
      key: 'voiceId',
      title: '音色',
      render: (row) => <CopyableCode value={row.voiceId} />,
    },
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
      render: (row) => (row.status === 'success' ? formatDuration(row.duration) : '--'),
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
        // 仅成功态有产物；等待/运行/失败既无音频也不展示试听/下载
        const audioUrl = resolveMediaUrl(row.resultUrl)
        const hasResult = row.status === 'success' && Boolean(audioUrl)
        return (
          <div className="flex justify-end gap-1">
            {hasResult && (
              <MediaPreview src={audioUrl} type="audio" title="合成音频">
                <Button variant="ghost" size="icon" aria-label="试听音频">
                  <Play />
                </Button>
              </MediaPreview>
            )}
            {hasResult && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="下载"
                render={<a href={audioUrl} download />}
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

export function SynthesisRecordPage() {
  // null = 全部，切换时写回真实状态；查询键含 status，变化即自动重新请求
  const [status, setStatus] = useState<VoiceTrainV2SynthesisStatus | null>(null)
  // 文案查看弹框状态
  const [textRecord, setTextRecord] = useState<VoiceTrainV2SynthesisRecord | null>(null)
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
  } = usePaginationQuery<VoiceTrainV2SynthesisRecord>({
    queryKey: [...voiceTrainV2QueryKeys.synthesisRecords, status],
    queryFn: ({ page, pageSize }) =>
      getVoiceTrainV2SynthesisList({
        page,
        limit: pageSize,
        ...(status ? { status } : {}), // 全部时不传 status
      }),
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const handleStatusChange = (value: string | null) => {
    setStatus(
      value === null || value === ALL_STATUS ? null : (value as VoiceTrainV2SynthesisStatus),
    )
    setPage(1)
  }

  const handleViewText = useCallback((row: VoiceTrainV2SynthesisRecord) => {
    setTextRecord(row)
  }, [])

  const handleTextOpenChange = useCallback((open: boolean) => {
    if (!open) setTextRecord(null)
  }, [])

  const handleViewDetail = useCallback((row: VoiceTrainV2SynthesisRecord) => {
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
    queryKey: voiceTrainV2QueryKeys.synthesisRecordDetail(detailId ?? ''),
    queryFn: () => {
      if (!detailId) throw new Error('缺少任务 ID')
      return getVoiceTrainV2SynthesisRecordDetail(detailId)
    },
    enabled: Boolean(detailId),
  })

  const detailFields = useMemo(() => (detail ? buildDetailFields(detail) : []), [detail])

  const cancelMutation = useMutation({ mutationFn: cancelVoiceTrainV2Synthesis })

  // 仅正在取消的那一行显示 loading
  const cancelingId = cancelMutation.isPending ? (cancelMutation.variables ?? null) : null

  const handleCancel = useCallback(
    async (row: VoiceTrainV2SynthesisRecord) => {
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
        onViewText: handleViewText,
        onViewDetail: handleViewDetail,
        onCancel: handleCancel,
        cancelingId,
      }),
    [handleViewText, handleViewDetail, handleCancel, cancelingId],
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
                  : (STATUS_META[value as VoiceTrainV2SynthesisStatus]?.label ?? String(value))
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
        emptyTitle="暂无合成记录"
        emptyDescription="在音色库V2 发起试听或正式合成后，可在此查看记录与产物。"
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
        title="音色合成任务详情"
        description={detailId ? `任务 ${detailId}` : undefined}
        loading={isDetailLoading}
        error={detailError}
        fields={detailFields}
      />
    </div>
  )
}
