import {
  AudioLines,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

import {
  deleteVoiceTrainV2Voice,
  getVoiceTrainV2SynthesisTask,
  getVoiceTrainV2Voices,
  synthesizeVoiceTrainV2Preview,
  updateVoiceTrainV2VoiceName,
  uploadVoiceTrainV2Voice,
  voiceTrainV2QueryKeys,
} from '@/api/voice-train-v2'
import { AppDialog } from '@/components/AppDialog'
import { ConfirmPopover } from '@/components/ConfirmPopover'
import { CopyButton } from '@/components/CopyButton'
import { DataTable } from '@/components/DataTable'
import type { DataTableColumn } from '@/components/DataTable'
import { MediaPreview } from '@/components/MediaPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIST_POLL_INTERVAL } from '@/constant/poll'
import { ROLE, usePermission } from '@/hooks/use-permission'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useUserStore } from '@/store/user'
import {
  MIN_TRAIN_AUDIO_DURATION_SEC,
  USER_VOICE_LIMIT,
  isVoiceTrainV2SynthesisFinished,
} from '@/types/voice-train-v2'
import type { VoiceTrainV2Voice } from '@/types/voice-train-v2'
import { formatBytes, formatDateTime, formatDuration } from '@/utils/format'
import { message } from '@/utils/message'
import { resolveMediaUrl } from '@/utils/media'

/** 合成任务进度轮询间隔：GPU 串行执行，1.5s 足以让进度看起来连续 */
const SYNTHESIS_POLL_INTERVAL = 1_500

/** 进行中的合成任务（同一时刻只允许一个，后端调度器本身也是串行的） */
interface ActiveSynthesis {
  taskId: string
  /** 发起合成的音色 id，用于定位表格行 */
  voiceId: string
  /** 音色名称，用于试听弹框标题 */
  voiceName: string
}

/** 组装表格列：操作列 render 需引用组件内的编辑/删除/合成回调 */
function buildColumns(handlers: {
  onEdit: (row: VoiceTrainV2Voice) => void
  onDelete: (id: string) => void
  onPreview: (row: VoiceTrainV2Voice) => void
  onSynthesize: (row: VoiceTrainV2Voice) => void
  deleting: boolean
  /** 合成任务提交中（已点击但还没拿到 taskId），用于挡住重复点击 */
  submitting: boolean
  /** 进行中的合成（含进度），无进行中任务时为 null */
  synthesis: { voiceId: string; stageLabel: string; progress: number } | null
}): DataTableColumn<VoiceTrainV2Voice>[] {
  return [
    {
      key: 'resourceName',
      title: '音色名称',
      render: (row) => <span className="font-medium">{row.resourceName}</span>,
    },
    {
      key: 'id',
      title: 'ID',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <code className="min-w-0 max-w-56 truncate d bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {row.id}
          </code>
          <CopyButton value={row.id} />
        </div>
      ),
    },
    {
      key: 'sourceOriginalName',
      title: '原始文件',
      width: 'max-w-56',
      render: (row) => (
        <span className="block truncate text-muted-foreground">
          {row.sourceOriginalName || '--'}
        </span>
      ),
    },
    {
      key: 'sourceDuration',
      title: '时长',
      className: 'tabular-nums',
      render: (row) => formatDuration(row.sourceDuration),
    },
    {
      key: 'sourceSize',
      title: '大小',
      className: 'tabular-nums',
      render: (row) => formatBytes(row.sourceSize),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      className: 'tabular-nums',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (row) => {
        const isSynthesizing = handlers.synthesis?.voiceId === row.id
        return (
          <div className="flex items-center justify-end gap-1">
            {isSynthesizing ? (
              <span className="mr-1 text-xs text-muted-foreground tabular-nums">
                {handlers.synthesis?.stageLabel || '合成中'}{' '}
                {Math.round((handlers.synthesis?.progress ?? 0) * 100)}%
              </span>
            ) : null}
            <MediaPreview
              src={resolveMediaUrl(row.referenceUrl)}
              type="audio"
              title={`${row.resourceName} · 原始素材`}
            >
              <Button variant="ghost" size="icon" aria-label="原始素材">
                <AudioLines />
              </Button>
            </MediaPreview>
            {/* 试听播放最近一次成功合成的克隆音频；未合成过（previewUrl 为空）时不可点 */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="试听"
              disabled={!row.previewUrl}
              onClick={() => handlers.onPreview(row)}
            >
              <Play />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="试听合成"
              disabled={
                Boolean(handlers.synthesis) || handlers.submitting || handlers.deleting
              }
              onClick={() => handlers.onSynthesize(row)}
            >
              {isSynthesizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="编辑"
              disabled={isSynthesizing}
              onClick={() => handlers.onEdit(row)}
            >
              <Pencil />
            </Button>
            <ConfirmPopover
              title="确认删除"
              description={`确认删除音色「${row.resourceName}」？删除后不可恢复。`}
              confirmLoading={handlers.deleting}
              onConfirm={() => handlers.onDelete(row.id)}
            >
              <Trash2 />
            </ConfirmPopover>
          </div>
        )
      },
    },
  ]
}

export function VoiceTrainV2Page() {
  const userId = useUserStore((state) => state.userId)
  const { role } = usePermission()
  const queryClient = useQueryClient()

  // 搜索：输入态 / 应用态分离，点搜索才生效；版本号保证同词重复搜索也重新请求
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchVersion, setSearchVersion] = useState(0)

  // 创建弹框状态
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createFile, setCreateFile] = useState<File | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)

  // 编辑（改名）弹框状态
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')

  // 试听合成：最近提交的任务（进度由轮询 query 提供）与试听弹框（受控）
  const [synthesis, setSynthesis] = useState<ActiveSynthesis | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const {
    data,
    total,
    page,
    pageSize,
    isLoading,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePaginationQuery<VoiceTrainV2Voice>({
    queryKey: [...voiceTrainV2QueryKeys.voices, keyword, searchVersion],
    queryFn: ({ page: pageNum, pageSize: size }) =>
      getVoiceTrainV2Voices({
        userId,
        page: pageNum,
        limit: size,
        ...(keyword ? { resourceName: keyword } : {}), // 无关键词不传，走全量
      }),
    enabled: Boolean(userId), // userId 未就绪时不请求
    // 进入页面每 10s 轮询列表，离开页面由 react-query 自动清除定时器
    refetchInterval: LIST_POLL_INTERVAL,
  })

  const activeTaskId = synthesis?.taskId ?? ''

  /**
   * 轮询合成任务进度。任务进入终态后返回 false 停止轮询，避免任务已完成还一直打接口；
   * 切换任务时 queryKey 变化会自然重新开始轮询；无 observer 时 react-query 自动停掉定时器。
   */
  const { data: synthesisTask, isError: isSynthesisTaskError } = useQuery({
    queryKey: voiceTrainV2QueryKeys.synthesisTask(activeTaskId),
    queryFn: () => getVoiceTrainV2SynthesisTask(activeTaskId),
    enabled: activeTaskId !== '',
    refetchInterval: (query) =>
      isVoiceTrainV2SynthesisFinished(query.state.data?.status)
        ? false
        : SYNTHESIS_POLL_INTERVAL,
  })

  /**
   * 是否仍有任务在跑：不单独存布尔量，由任务状态推导，避免两处状态不一致。
   * 进度查询报错（重试用尽）时也解除进行中标记，否则按钮会被永远锁住；
   * refetchInterval 之后仍会继续重试，网络恢复即自动续上进度。
   */
  const isSynthesizing =
    Boolean(synthesis) &&
    !isSynthesisTaskError &&
    !isVoiceTrainV2SynthesisFinished(synthesisTask?.status)

  // 未过滤的音色总数：上限判断必须基于它，列表 total 会被搜索关键词过滤成更小的值
  const { data: voiceCount = 0 } = useQuery({
    queryKey: [...voiceTrainV2QueryKeys.voiceCount, userId],
    queryFn: () => getVoiceTrainV2Voices({ userId, page: 1, limit: 1 }),
    select: (result) => result.total,
    enabled: Boolean(userId),
  })

  const uploadMutation = useMutation({ mutationFn: uploadVoiceTrainV2Voice })
  const updateMutation = useMutation({
    mutationFn: ({ id, resourceName }: { id: string; resourceName: string }) =>
      updateVoiceTrainV2VoiceName({ id, resourceName }),
  })
  const deleteMutation = useMutation({ mutationFn: deleteVoiceTrainV2Voice })
  const synthesizeMutation = useMutation({ mutationFn: synthesizeVoiceTrainV2Preview })

  /** 新增/删除都会改变总数，失效 voices 前缀即可同时刷新列表与总数（invalidateQueries 按前缀匹配） */
  const refreshList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: voiceTrainV2QueryKeys.voices }),
    [queryClient],
  )

  /**
   * 合成到达终态时收尾：成功则立刻刷新列表（后端已把 previewUrl 回写到音色记录，
   * 不必等下一次 5s 轮询），失败则提示任务里的原因。
   *
   * 这里只做「外部系统」副作用，不写组件状态 —— 进行中与否由上面的 isSynthesizing 推导。
   * 轮询接口是 silent 的，故失败提示不会与拦截器重复；ref 记账保证同一任务只收尾一次。
   */
  const settledTaskIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!synthesisTask || !isVoiceTrainV2SynthesisFinished(synthesisTask.status)) return
    if (settledTaskIdRef.current === synthesisTask.id) return
    settledTaskIdRef.current = synthesisTask.id

    refreshList()
    if (synthesisTask.status === 'success') {
      message.success('试听合成完成，点击「试听」播放')
      return
    }
    message.error(synthesisTask.message || '试听合成失败')
  }, [synthesisTask, refreshList])

  // 进度查询本身失败（已 silent，不会自动提示）：提示一次即可，同一任务不重复刷屏
  const failedPollTaskIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isSynthesisTaskError || activeTaskId === '') return
    if (failedPollTaskIdRef.current === activeTaskId) return
    failedPollTaskIdRef.current = activeTaskId
    message.error('查询合成进度失败，请稍后重试')
  }, [isSynthesisTaskError, activeTaskId])

  // 弹框在元数据返回前被关闭/页面卸载时，回收预览用的 blob 地址
  const objectUrlRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  const resetCreateForm = useCallback(() => {
    setCreateName('')
    setCreateFile(null)
    setAudioDuration(null)
  }, [])

  /**
   * 选中文件后先本地读时长：不足 10 秒直接拦截，省掉一次注定失败的上传。
   * 读取失败（部分容器格式拿不到有限时长）不做前端拦截，交由后端判定。
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    // 置空 value，否则连续选择同一个文件不触发 change
    event.target.value = ''
    setCreateFile(file)
    setAudioDuration(null)
    if (!file) return

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : null)
    })
    audio.addEventListener('error', () => setAudioDuration(null))
    audio.src = objectUrl
  }

  const handleCreate = useCallback(async () => {
    const name = createName.trim()
    if (!name || !createFile || !userId) return
    if (audioDuration !== null && audioDuration < MIN_TRAIN_AUDIO_DURATION_SEC) return
    try {
      await uploadMutation.mutateAsync({ file: createFile, resourceName: name, userId })
      setCreateOpen(false)
      resetCreateForm()
      await refreshList()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [createName, createFile, userId, audioDuration, uploadMutation, resetCreateForm, refreshList])

  const handleOpenEdit = useCallback((row: VoiceTrainV2Voice) => {
    setEditId(row.id)
    setEditName(row.resourceName)
    setEditOpen(true)
  }, [])

  const handleEdit = useCallback(async () => {
    const name = editName.trim()
    if (!name || !editId) return
    try {
      await updateMutation.mutateAsync({ id: editId, resourceName: name })
      setEditOpen(false)
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [editName, editId, updateMutation, refetch])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        await refreshList()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [deleteMutation, refreshList],
  )

  const handlePreview = useCallback((row: VoiceTrainV2Voice) => {
    if (!row.previewUrl) return
    setPreview({ url: row.previewUrl, title: `${row.resourceName} · 克隆试听` })
  }, [])

  /** 提交试听合成：拿到 taskId 后交给上面那个轮询 query 接管进度 */
  const handleSynthesize = useCallback(
    async (row: VoiceTrainV2Voice) => {
      if (!userId || isSynthesizing) return
      try {
        const accepted = await synthesizeMutation.mutateAsync({ voiceId: row.id, userId })
        setSynthesis({
          taskId: accepted.taskId,
          voiceId: row.id,
          voiceName: row.resourceName,
        })
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [userId, isSynthesizing, synthesizeMutation],
  )

  const columns = useMemo(
    () =>
      buildColumns({
        onEdit: handleOpenEdit,
        onDelete: handleDelete,
        onPreview: handlePreview,
        onSynthesize: handleSynthesize,
        deleting: deleteMutation.isPending,
        submitting: synthesizeMutation.isPending,
        // 仅进行中的任务才占用行内进度位，终态后按钮恢复可用
        synthesis:
          synthesis && isSynthesizing
            ? {
                voiceId: synthesis.voiceId,
                stageLabel: synthesisTask?.stageLabel ?? '',
                progress: synthesisTask?.progress ?? 0,
              }
            : null,
      }),
    [
      handleOpenEdit,
      handleDelete,
      handlePreview,
      handleSynthesize,
      deleteMutation.isPending,
      synthesizeMutation.isPending,
      synthesis,
      isSynthesizing,
      synthesisTask,
    ],
  )

  const handleSearch = () => {
    setKeyword(keywordInput.trim())
    setPage(1)
    setSearchVersion((version) => version + 1)
  }

  const handleReset = () => {
    setKeywordInput('')
    setKeyword('')
    setPage(1)
    setSearchVersion((version) => version + 1)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  // 普通 user 至多 USER_VOICE_LIMIT 条音色，达到上限后不再展示创建入口；
  // 其余角色不受限。profile 未就绪（role 为空）时先不渲染，避免按钮闪烁。
  const canCreate =
    Boolean(role) && (role !== ROLE.USER || voiceCount < USER_VOICE_LIMIT)

  const durationTooShort =
    audioDuration !== null && audioDuration < MIN_TRAIN_AUDIO_DURATION_SEC
  const canSubmitCreate = Boolean(createName.trim()) && Boolean(createFile) && !durationTooShort

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmitCreate && !uploadMutation.isPending) {
      handleCreate()
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && editName.trim() && !updateMutation.isPending) {
      handleEdit()
    }
  }

  let fileHint: string
  if (durationTooShort) {
    fileHint = `音频时长不能低于 ${MIN_TRAIN_AUDIO_DURATION_SEC} 秒（当前 ${audioDuration?.toFixed(1)} 秒）`
  } else if (createFile) {
    fileHint = `${createFile.name} · ${formatBytes(createFile.size)}${
      audioDuration === null ? '' : ` · 时长 ${formatDuration(audioDuration)}`
    }`
  } else {
    fileHint = `支持 mp3、wav 等音频格式，时长不少于 ${MIN_TRAIN_AUDIO_DURATION_SEC} 秒`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索音色名称"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-64"
        />
        <Button data-icon="inline-start" onClick={handleSearch}>
          <Search />
          搜索
        </Button>
        <Button variant="ghost" data-icon="inline-start" onClick={handleReset}>
          <RotateCcw />
          重置
        </Button>
        {canCreate ? (
          <Button
            data-icon="inline-start"
            className="ml-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            创建音色
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        loading={isLoading || !userId}
        error={error}
        onRetry={refetch}
        emptyTitle="暂无音色"
        emptyDescription="上传一段不少于 10 秒的音频，即可创建你自己的音色。"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

      <AppDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm() // 关闭时清空，避免下次打开残留
        }}
        title="创建音色"
        description="上传音频并命名，作为后续训练使用的音色素材。"
        confirmText="创建"
        confirmLoading={uploadMutation.isPending}
        confirmDisabled={!canSubmitCreate}
        onConfirm={handleCreate}
      >
        <div className="flex flex-col gap-4 px-2.5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-voice-name">音色名称</Label>
            <Input
              id="create-voice-name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              onKeyDown={handleCreateKeyDown}
              placeholder="请输入音色名称"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-voice-file">音频文件</Label>
            <Input
              id="create-voice-file"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
            />
            <p
              className={
                durationTooShort
                  ? 'text-xs text-destructive'
                  : 'text-xs text-muted-foreground'
              }
            >
              {fileHint}
            </p>
          </div>
        </div>
      </AppDialog>

      <AppDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditId('')
            setEditName('')
          }
        }}
        title="编辑音色"
        description="仅允许修改音色名称。"
        confirmLoading={updateMutation.isPending}
        confirmDisabled={!editName.trim()}
        onConfirm={handleEdit}
      >
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Label htmlFor="edit-voice-name">音色名称</Label>
          <Input
            id="edit-voice-name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="请输入音色名称"
            autoFocus
          />
        </div>
      </AppDialog>

      {/* 试听弹框：行内「试听」与合成完成后自动播放共用同一个受控实例 */}
      <MediaPreview
        src={resolveMediaUrl(preview?.url)}
        type="audio"
        title={preview?.title}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      />
    </div>
  )
}
