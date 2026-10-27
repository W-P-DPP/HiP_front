import {
  ArrowLeft,
  Images,
  Loader2,
  ScanEye,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { createVlmTaskFromMaterial, createVlmTaskFromMedia } from '@/api/vlm'
import { MaterialPickerDialog } from '@/components/MaterialPickerDialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useImageUnderstanding } from '@/hooks/use-image-understanding'
import type { VideoMaterial } from '@/types/video-material'
import type { VlmResult, VlmTaskMode } from '@/types/vlm'
import { formatBytes } from '@/utils/format'
import { isSupportedImageFile } from '@/utils/material'
import { resolveMediaUrl } from '@/utils/media'
import { message } from '@/utils/message'

/** 输出模式选项（ToggleGroup 单选） */
const MODE_OPTIONS = [
  { value: 'json', label: 'JSON 结构化' },
  { value: 'text', label: '纯文本' },
] as const

/** 是否为合法的输出模式（ToggleGroup 的值为 string[]，收窄后写入状态） */
function isVlmTaskMode(value: string | undefined): value is VlmTaskMode {
  return value === 'json' || value === 'text'
}

/** 一组成员徽标（物体 / 动作 / 标签），空数组不渲染 */
function ResultBadges({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}

/** 理解结果：结构化字段（mode=json）+ 模型原始输出 + 元信息 */
function ResultView({
  result,
  rawText,
  modelId,
  elapsedMs,
}: {
  result: VlmResult | null
  rawText: string
  modelId: string
  elapsedMs: number
}) {
  return (
    <div className="flex flex-col gap-4">
      {result ? (
        <div className="flex flex-col gap-4 xl border border-border bg-muted/40 p-4">
          <p className="text-sm">{result.description || '—'}</p>
          {result.sceneType ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">场景类型</span>
              <Badge variant="outline">{result.sceneType}</Badge>
            </div>
          ) : null}
          <ResultBadges label="画面物体" items={result.objects} />
          <ResultBadges label="动作" items={result.actions} />
          <ResultBadges label="标签" items={result.tags} />
        </div>
      ) : null}

      {rawText ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">模型原始输出</span>
          <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            {rawText}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {modelId ? <span>模型：{modelId}</span> : null}
        {elapsedMs > 0 ? <span>耗时：{(elapsedMs / 1000).toFixed(1)}s</span> : null}
      </div>
    </div>
  )
}

/**
 * 图像理解：上传本地图片或从素材库选择图片（二选一），提交后轮询排队位置与进度，
 * 成功后展示结构化结果或模型原始文本。
 */
export function ImageUnderstandingPage() {
  const navigate = useNavigate()
  // 来源二选一：仅 upload 与 material 其中之一有值
  const [sourceTab, setSourceTab] = useState<'upload' | 'material'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [material, setMaterial] = useState<VideoMaterial | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<VlmTaskMode>('json')

  // 源标识：上传取本地文件稳定标识，素材取 fileId；变化即视为上一轮结果失效
  const sourceKey = file
    ? `upload:${file.name}:${file.size}:${file.lastModified}`
    : material
      ? `material:${material.fileId}`
      : ''

  // 提交函数：上传走 multipart（file），素材走 JSON（fileId）；可选带 prompt/mode
  const submit = useMemo(() => {
    const options = { prompt: prompt.trim() || undefined, mode }
    if (file) return () => createVlmTaskFromMedia(file, options)
    if (material) return () => createVlmTaskFromMaterial(material.fileId, options)
    return undefined
  }, [file, material, prompt, mode])

  const vlm = useImageUnderstanding({ sourceKey, submit })

  // 本地文件预览地址：绑定选中的 File，换文件 / 卸载时释放
  const localPreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(
    () => () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
    },
    [localPreviewUrl],
  )

  const sourcePreviewUrl = file
    ? localPreviewUrl
    : material
      ? resolveMediaUrl(material.file.url)
      : ''
  const sourceName = file ? file.name : material ? material.fileName || material.keyword : ''

  // 切换来源方式会清空已选来源，保证「上传」与「素材库选择」二选一
  const handleTabChange = useCallback((value: string) => {
    if (value !== 'upload' && value !== 'material') return
    setSourceTab(value)
    setFile(null)
    setMaterial(null)
  }, [])

  // 选择文件后校验类型（仅图片），清空 input.value 允许重复选择同一文件
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0] ?? null
      event.target.value = ''
      if (!picked) return
      if (!isSupportedImageFile(picked)) {
        message.error('仅支持上传图片文件')
        return
      }
      if (vlm.isGenerating) return
      setFile(picked)
      setMaterial(null)
    },
    [vlm.isGenerating],
  )

  const handlePickMaterial = useCallback((materials: VideoMaterial[]) => {
    const picked = materials[0]
    if (!picked) return
    setMaterial(picked)
    setFile(null)
  }, [])

  const percent = Math.round(vlm.progress * 100)

  let resultContent: ReactNode
  if (vlm.isGenerating) {
    resultContent = (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  } else if (vlm.status === 'success') {
    resultContent = (
      <ResultView
        result={vlm.result}
        rawText={vlm.rawText}
        modelId={vlm.task?.modelId ?? ''}
        elapsedMs={vlm.task?.elapsedMs ?? 0}
      />
    )
  } else if (vlm.status === 'failed') {
    resultContent = null
  } else if (sourceKey) {
    resultContent = (
      <p className="text-sm text-muted-foreground">尚未开始理解，点击上方按钮开始。</p>
    )
  } else {
    resultContent = <p className="text-sm text-muted-foreground">请先选择图像。</p>
  }

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
          <CardTitle>图像理解</CardTitle>
          <CardDescription>
            上传图像或从素材库选择，自动分析画面内容并返回结构化结果。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Tabs value={sourceTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="upload">上传图像</TabsTrigger>
              <TabsTrigger value="material">从素材库选择</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="flex flex-col gap-1.5">
              <Label htmlFor="vlm-image">图像文件</Label>
              <Input
                id="vlm-image"
                type="file"
                accept="image/*"
                disabled={vlm.isGenerating}
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                {file
                  ? `${file.name} · ${formatBytes(file.size)}`
                  : '支持常见图片格式，选择后上传并理解。'}
              </p>
            </TabsContent>

            <TabsContent value="material" className="flex flex-col gap-1.5">
              <Label>素材图像</Label>
              <Button
                variant="outline"
                className="w-fit"
                data-icon="inline-start"
                disabled={vlm.isGenerating}
                onClick={() => setPickerOpen(true)}
              >
                <Images />
                {material ? '重新选择素材' : '从素材库选择'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {material
                  ? material.fileName || material.keyword
                  : '仅展示图片素材，单选。'}
              </p>
            </TabsContent>
          </Tabs>

          {sourcePreviewUrl ? (
            <div className="flex flex-col gap-3 xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <ScanEye className="size-4" />
                </span>
                <span className="truncate text-sm font-medium">{sourceName}</span>
                <Badge variant="secondary" className="ml-auto">
                  已选择
                </Badge>
              </div>
              <img
                src={sourcePreviewUrl}
                alt={sourceName}
                className="max-h-80 w-full rounded-lg object-contain"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vlm-prompt">提示词（可选）</Label>
              <Textarea
                id="vlm-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="留空则使用后端默认提示词"
                disabled={vlm.isGenerating}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>输出模式</Label>
              <ToggleGroup
                value={[mode]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (isVlmTaskMode(next)) setMode(next)
                }}
              >
                {MODE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    variant="outline"
                    disabled={vlm.isGenerating}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Button
              className="w-fit"
              data-icon="inline-start"
              disabled={!sourceKey || vlm.isGenerating}
              onClick={vlm.analyze}
            >
              {vlm.isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {vlm.isGenerating ? '理解中…' : '图像理解'}
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {vlm.status === 'pending' ? (
              <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="text-sm">
                  排队中 · 当前第 {vlm.queuePosition ?? '-'} 位
                  {vlm.queueDepth > 0 ? ` · 前方 ${vlm.waitingAhead} 个任务` : ''}
                </span>
              </div>
            ) : null}

            {vlm.status === 'running' ? (
              <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  <span>{vlm.stageLabel || '理解中'}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {percent}%
                  </span>
                </div>
                <Progress value={percent} />
              </div>
            ) : null}

            {vlm.status === 'failed' ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>理解失败</AlertTitle>
                <AlertDescription>{vlm.errorMessage || '请稍后重试。'}</AlertDescription>
              </Alert>
            ) : null}

            {resultContent}
          </div>
        </CardContent>
      </Card>

      <MaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        maxCount={1}
        mediaType="image"
        title="选择图像素材"
        description="仅展示图片素材，单选。"
        onConfirm={handlePickMaterial}
      />
    </div>
  )
}
