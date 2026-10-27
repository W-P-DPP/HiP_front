import { ArrowLeft, Upload } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  getVoiceTrainResult,
  getVoiceTrainTexts,
  submitVoiceTrainTask,
  voiceTrainingQueryKeys,
} from '@/api/voice-training'
import { AppDialog } from '@/components/AppDialog'
import { Button } from '@/components/ui/button'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserStore } from '@/store/user'
import type { VoiceTrainTextSeg } from '@/types/voice-training'
import { message } from '@/utils/message'

/** 训练结果轮询间隔（训练任务提交成功后每 5s 查一次） */
const VOICE_TRAIN_POLL_INTERVAL = 5_000

/** 轮询最大次数兜底（≈10 分钟），防止任务异常丢失后无限空轮询 */
const VOICE_TRAIN_POLL_MAX_ATTEMPTS = 120

/** 训练样本列表加载占位（3 行骨架，尺寸对齐真实样本行） */
function SampleListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-4 xl border border-border p-5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface SampleItemProps {
  index: number
  seg: VoiceTrainTextSeg
  onUpload: (seg: VoiceTrainTextSeg) => void
}

/** 单个训练样本：序号徽标 + 朗读文本 + 上传训练音频按钮 */
function SampleItem({ index, seg, onUpload }: SampleItemProps) {
  return (
    <li className="flex items-start gap-4 xl border border-border bg-muted/50 p-5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
        {index + 1}
      </span>
      <p className="flex-1 text-sm leading-relaxed text-foreground">{seg.segText}</p>
      <Button
        variant="outline"
        size="sm"
        data-icon="inline-start"
        className="shrink-0"
        onClick={() => onUpload(seg)}
      >
        <Upload />
        上传训练音频
      </Button>
    </li>
  )
}

/** 新增音色页：进入后拉取训练样本文本，为每条样本上传朗读音频 */
export function VoiceTrainingCreatePage() {
  const navigate = useNavigate()
  const { data: text, isLoading, isError, refetch } = useQuery({
    queryKey: voiceTrainingQueryKeys.texts,
    queryFn: getVoiceTrainTexts,
  })

  // 后端分段顺序可能不稳定，按 segSort 升序渲染
  const samples = useMemo(
    () => [...(text?.textSegs ?? [])].sort((a, b) => a.segSort - b.segSort),
    [text],
  )
  // 当前登录用户 id（AdminLayout 已通过 profile 查询填充）
  const userId = useUserStore((state) => state.userId)

  // 上传训练音频弹框状态
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadSeg, setUploadSeg] = useState<VoiceTrainTextSeg | null>(null)
  const [uploadIndex, setUploadIndex] = useState(0)
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSex, setUploadSex] = useState(1) // 性别：1 男 / 2 女，默认男
  const [uploadSubmitting, setUploadSubmitting] = useState(false)

  // 正在后台轮询的训练任务：taskId -> { timer, attempts }。
  // 提交成功即关闭弹框、训练在后台继续，故定时器存 ref，页面卸载时统一清除
  const pollTasksRef = useRef<
    Record<string, { timer?: ReturnType<typeof setTimeout>; attempts: number }>
  >({})

  /** 停止并移除某任务的轮询定时器 */
  const stopPoll = useCallback((taskId: string) => {
    const task = pollTasksRef.current[taskId]
    if (task?.timer) clearTimeout(task.timer)
    delete pollTasksRef.current[taskId]
  }, [])

  // 页面卸载（返回列表等）时清除所有后台轮询定时器，避免残留请求
  useEffect(() => {
    const tasks = pollTasksRef.current
    return () => {
      for (const task of Object.values(tasks)) clearTimeout(task.timer)
    }
  }, [])

  /**
   * 后台轮询单个训练任务直至终态：
   * - trainStatus 1=成功、0=失败（本结果接口语义）→ 退出并提示
   * - 接口返回无数据 → 视为未就绪，5s 后继续
   * - 接口报错（获取结果失败）→ 退出并提示后端错误，不再静默重试
   * 超过最大次数兜底停止。用函数声明以便自递归调度下一轮（递归 setTimeout 天然规避轮询重叠）。
   */
  async function pollResult(taskId: string) {
    let task = pollTasksRef.current[taskId]
    if (!task) return // 已被停止/页面卸载
    try {
      const result = await getVoiceTrainResult(taskId)
      task = pollTasksRef.current[taskId]
      if (!task) return // 等待结果期间已被停止
      if (result) {
        if (result.trainStatus === 1) {
          message.success('音色训练成功')
          stopPoll(taskId)
          return
        }
        if (result.trainStatus === 0) {
          message.error('音色训练失败')
          stopPoll(taskId)
          return
        }
      }
    } catch (error) {
      task = pollTasksRef.current[taskId]
      if (!task) return // 等待结果期间已被停止
      // 获取结果失败（业务失败/接口错误）：退出轮询并提示，错误文案取后端返回
      message.error(error instanceof Error ? error.message : '获取训练结果失败')
      stopPoll(taskId)
      return
    }
    task.attempts += 1
    if (task.attempts > VOICE_TRAIN_POLL_MAX_ATTEMPTS) {
      message.warning('训练超时，请稍后在音色列表查看')
      stopPoll(taskId)
      return
    }
    task.timer = setTimeout(() => void pollResult(taskId), VOICE_TRAIN_POLL_INTERVAL)
  }

  const handleOpenUpload = useCallback(
    (seg: VoiceTrainTextSeg) => {
      const index = samples.findIndex((item) => item.segId === seg.segId)
      setUploadSeg(seg)
      setUploadIndex(index)
      setUploadName('')
      setUploadFile(null)
      setUploadSex(1)
      setUploadOpen(true)
    },
    [samples],
  )

  const handleUploadOpenChange = useCallback((open: boolean) => {
    setUploadOpen(open)
    if (!open) {
      setUploadSeg(null)
      setUploadName('')
      setUploadFile(null)
      setUploadSex(1)
    }
  }, [])

  /** 提交训练任务：成功后立即关弹框，训练转入后台轮询（供 AppDialog onConfirm 调用，非 hook，故用普通函数） */
  async function handleUploadConfirm() {
    if (!uploadSeg || !uploadName.trim() || !uploadFile || !text || uploadSubmitting) return
    setUploadSubmitting(true)
    try {
      const { taskId } = await submitVoiceTrainTask({
        file: uploadFile,
        userId,
        textSegId: uploadSeg.segId,
        textId: text.textId,
        resourceName: uploadName.trim(),
        sex: uploadSex,
      })
      // 提交成功立即关闭弹框（创建成功提示由拦截器弹），训练任务转入后台轮询直至终态
      handleUploadOpenChange(false)
      pollTasksRef.current[taskId] = { attempts: 0 }
      void pollResult(taskId)
    } catch {
      // 提交失败：拦截器已弹错误提示，弹框保持打开供用户重试
    } finally {
      setUploadSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        data-icon="inline-start"
        className="w-fit"
        onClick={() => navigate('/voice-training')}
      >
        <ArrowLeft />
        返回列表
      </Button>

          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">训练样本</CardTitle>
            <CardDescription className="max-w-2xl">
              {text
                ? `「${text.textName}」：朗读以下文本并上传录音，用于训练音色。`
                : '朗读以下文本并上传录音，用于训练音色。'}
            </CardDescription>
          </div>

          {isLoading && <SampleListSkeleton />}

          {isError && (
            <div className="flex flex-col items-start gap-3 xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm text-destructive">训练样本加载失败，请稍后重试。</p>
              <Button variant="outline" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          )}

          {!isLoading && !isError && samples.length > 0 && (
            <ol className="flex flex-col gap-4">
              {samples.map((seg, index) => (
                <SampleItem
                  key={seg.segId}
                  index={index}
                  seg={seg}
                  onUpload={handleOpenUpload}
                />
              ))}
            </ol>
          )}

          {!isLoading && !isError && samples.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无训练样本。</p>
          )}

      <AppDialog
        open={uploadOpen}
        onOpenChange={handleUploadOpenChange}
        title="上传训练音频"
        description={
          uploadSeg ? `为第 ${uploadIndex + 1} 条样本上传朗读音频` : undefined
        }
        confirmText="上传"
        confirmDisabled={!uploadName.trim() || !uploadFile}
        confirmLoading={uploadSubmitting}
        onConfirm={handleUploadConfirm}
      >
        <div className="flex flex-col gap-4 px-2.5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audio-name">名称</Label>
            <Input
              id="audio-name"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="请输入音色名称"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>性别</Label>
            <Select
              value={String(uploadSex)}
              onValueChange={(value) => setUploadSex(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => (value === '2' ? '女' : '男')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">男</SelectItem>
                <SelectItem value="2">女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audio-file">音频文件</Label>
            <Input
              id="audio-file"
              type="file"
              accept="audio/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            {uploadFile ? (
              <p className="text-xs text-muted-foreground">{uploadFile.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">支持 mp3、wav 等音频格式</p>
            )}
          </div>
        </div>
      </AppDialog>
    </div>
  )
}
