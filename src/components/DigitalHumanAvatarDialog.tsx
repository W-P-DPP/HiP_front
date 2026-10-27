import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'

import { createDigitalHumanAvatar } from '@/api/digital-human'
import { AppDialog } from '@/components/AppDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_AVATAR_VIDEO_DURATION_SEC } from '@/types/digital-human'
import type { DigitalHumanAvatar } from '@/types/digital-human'
import { formatBytes, formatDuration } from '@/utils/format'

interface DigitalHumanAvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 归属用户 id，未就绪时不可提交 */
  userId: string
  /** 创建成功回调：由调用方决定刷新列表 / 选中新形象 */
  onCreated?: (avatar: DigitalHumanAvatar) => void
}

/**
 * 创建数字人形象弹框：上传一段视频并命名。
 * 数字人管理页与数字人工厂共用，成功提示与失败提示均由 axios 拦截器统一处理。
 */
export function DigitalHumanAvatarDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: DigitalHumanAvatarDialogProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)

  const createMutation = useMutation({ mutationFn: createDigitalHumanAvatar })

  // 弹框在元数据返回前被关闭/组件卸载时，回收预览用的 blob 地址
  const objectUrlRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  const resetForm = useCallback(() => {
    setName('')
    setFile(null)
    setVideoDuration(null)
  }, [])

  /**
   * 选中文件后先本地读时长：不足 5 秒直接拦截，省掉一次注定失败的上传。
   * 读取失败（部分容器格式拿不到有限时长）不做前端拦截，交由后端判定。
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    // 置空 value，否则连续选择同一个文件不触发 change
    event.target.value = ''
    setFile(nextFile)
    setVideoDuration(null)
    if (!nextFile) return

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const objectUrl = URL.createObjectURL(nextFile)
    objectUrlRef.current = objectUrl
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', () => {
      setVideoDuration(Number.isFinite(video.duration) ? video.duration : null)
    })
    video.addEventListener('error', () => setVideoDuration(null))
    video.src = objectUrl
  }

  const durationTooShort =
    videoDuration !== null && videoDuration < MIN_AVATAR_VIDEO_DURATION_SEC
  const canSubmit =
    Boolean(name.trim()) && Boolean(file) && Boolean(userId) && !durationTooShort

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !file || !userId || durationTooShort) return
    try {
      const created = await createMutation.mutateAsync({
        file,
        name: trimmedName,
        userId,
      })
      onOpenChange(false)
      resetForm()
      onCreated?.(created)
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [name, file, userId, durationTooShort, createMutation, onOpenChange, resetForm, onCreated])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmit && !createMutation.isPending) {
      handleCreate()
    }
  }

  let fileHint: string
  if (durationTooShort) {
    fileHint = `视频时长不能少于 ${MIN_AVATAR_VIDEO_DURATION_SEC} 秒（当前 ${videoDuration?.toFixed(1)} 秒）`
  } else if (file) {
    fileHint = `${file.name} · ${formatBytes(file.size)}${
      videoDuration === null ? '' : ` · 时长 ${formatDuration(videoDuration)}`
    }`
  } else {
    fileHint = `支持 mp4 等视频格式，时长不少于 ${MIN_AVATAR_VIDEO_DURATION_SEC} 秒`
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetForm() // 关闭时清空，避免下次打开残留
      }}
      title="创建数字人"
      description="上传一段视频并命名，作为数字人形象素材。"
      confirmText="创建"
      confirmLoading={createMutation.isPending}
      confirmDisabled={!canSubmit}
      onConfirm={handleCreate}
    >
      <div className="flex flex-col gap-4 px-2.5 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="digital-human-avatar-name">数字人名称</Label>
          <Input
            id="digital-human-avatar-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入数字人名称"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="digital-human-avatar-file">视频文件</Label>
          <Input
            id="digital-human-avatar-file"
            type="file"
            accept="video/*"
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
  )
}
