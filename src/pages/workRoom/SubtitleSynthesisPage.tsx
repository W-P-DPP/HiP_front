import {
  ArrowLeft,
  AudioLines,
  Download,
  FileText,
  Film,
  Loader2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { createSubtitleTaskFromMedia } from '@/api/subtitle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useSubtitleGeneration } from '@/hooks/use-subtitle-generation'
import { formatBytes } from '@/utils/format'
import { isSupportedMediaFile, resolveMediaFileType } from '@/utils/material'
import { resolveMediaUrl } from '@/utils/media'
import { message } from '@/utils/message'
import { parseSrt } from '@/utils/srt'

/** 字幕合成：上传本地音视频直接建任务（from-media），复用短视频工厂的字幕轮询，完成后可下载 SRT */
export function SubtitleSynthesisPage() {
  const navigate = useNavigate()
  // 选中的本地音视频文件；其标识作为源 key，换文件即失效上一轮结果
  const [picked, setPicked] = useState<File | null>(null)

  const sourceKey = picked ? `${picked.name}:${picked.size}:${picked.lastModified}` : ''
  // 未选文件时不传 submit：hook 内 generate 会因缺少源而拒绝提交
  const submit = useMemo(
    () => (picked ? () => createSubtitleTaskFromMedia(picked) : undefined),
    [picked],
  )
  const subtitle = useSubtitleGeneration({ sourceKey, submit })

  // 本地文件预览地址：绑定选中的 File，换文件 / 卸载时释放
  const previewUrl = useMemo(() => (picked ? URL.createObjectURL(picked) : ''), [picked])
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )
  const mediaType = picked ? resolveMediaFileType(picked) : 'audio'

  const srtUrl = subtitle.srtUrl ? resolveMediaUrl(subtitle.srtUrl) : ''
  const cues = parseSrt(subtitle.subtitle)
  const percent = Math.round(subtitle.progress * 100)

  // 选择文件后校验类型（音/视频），清空 input.value 允许重复选择同一文件
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      event.target.value = ''
      if (!file) return
      if (!isSupportedMediaFile(file)) {
        message.error('仅支持上传音频或视频文件')
        return
      }
      if (subtitle.isGenerating) return
      setPicked(file)
    },
    [subtitle.isGenerating],
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Button
        variant="ghost"
        data-icon="inline-start"
        className="w-fit"
        onClick={() => navigate('/work-room')}
      >
        <ArrowLeft />
        返回工作台
      </Button>

      <Card className="shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
        <CardHeader>
          <CardTitle>字幕合成</CardTitle>
          <CardDescription>
            上传音视频文件，自动识别生成 SRT 字幕，完成后可预览并下载。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subtitle-media">音视频文件</Label>
              <Input
                id="subtitle-media"
                type="file"
                accept="audio/*,video/*"
                disabled={subtitle.isGenerating}
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                {picked
                  ? `${picked.name} · ${formatBytes(picked.size)}`
                  : '支持音频与视频格式，选择后上传并合成字幕。'}
              </p>
            </div>

            {picked ? (
              <div className="flex flex-col gap-3 xl border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
                    {mediaType === 'video' ? (
                      <Film className="size-4" />
                    ) : (
                      <AudioLines className="size-4" />
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">{picked.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    已选择
                  </Badge>
                </div>
                {mediaType === 'video' ? (
                  <video src={previewUrl} controls className="w-full rounded-lg" />
                ) : (
                  <audio src={previewUrl} controls className="w-full" />
                )}
              </div>
            ) : null}

            <Button
              className="w-fit"
              data-icon="inline-start"
              disabled={!picked || subtitle.isGenerating}
              onClick={subtitle.generate}
            >
              {subtitle.isGenerating ? <Loader2 className="animate-spin" /> : <FileText />}
              {subtitle.isGenerating ? '合成中…' : '上传并合成'}
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {subtitle.status === 'pending' ? (
              <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="text-sm">
                  排队中 · 当前第 {subtitle.queuePosition ?? '-'} 位
                  {subtitle.queueDepth > 0 ? ` · 前方 ${subtitle.waitingAhead} 个任务` : ''}
                </span>
              </div>
            ) : null}

            {subtitle.status === 'running' ? (
              <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  <span>{subtitle.stageLabel || '生成中'}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
                </div>
                <Progress value={percent} />
              </div>
            ) : null}

            {subtitle.status === 'failed' ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>生成失败</AlertTitle>
                <AlertDescription>{subtitle.errorMessage || '请稍后重试。'}</AlertDescription>
              </Alert>
            ) : null}

            {subtitle.isGenerating ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : subtitle.status === 'success' ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {cues.length > 0 ? `已生成 ${cues.length} 条字幕` : '字幕已生成'}
                  </span>
                  {srtUrl ? (
                    <Button
                      className="ml-auto"
                      data-icon="inline-start"
                      render={<a href={srtUrl} download />}
                    >
                      <Download />
                      下载字幕
                    </Button>
                  ) : null}
                </div>
                {cues.length > 0 ? (
                  <ol className="flex flex-col gap-2">
                    {cues.map((cue) => (
                      <li
                        key={cue.index}
                        className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3"
                      >
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {cue.time}
                        </span>
                        <span className="text-sm">{cue.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : subtitle.subtitle ? (
                  <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                    {subtitle.subtitle}
                  </pre>
                ) : null}
              </div>
            ) : picked ? (
              <p className="text-sm text-muted-foreground">
                尚未生成字幕，点击上方按钮开始合成。
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">请先选择音视频文件。</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
