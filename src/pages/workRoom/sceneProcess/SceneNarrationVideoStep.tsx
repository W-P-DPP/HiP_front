import { Download, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { VOICE_SPEED_MODES } from '@/constant/synthesis'
import type { VoiceTrainV2SpeedMode } from '@/types/voice-train-v2'
import { VideoResult } from '../stages/VideoResult'
import { StepFooter } from '../stages/StepFooter'
import type { SceneNarrationVideoStageController } from './controller'

interface SceneNarrationVideoStepProps {
  factory: SceneNarrationVideoStageController
}

/** 是否为合法的速度档位（ToggleGroup 的值为 string[]，收窄后写入控制器） */
function isSpeedMode(value: string | undefined): value is VoiceTrainV2SpeedMode {
  return value === 'fast' || value === 'balanced' || value === 'quality'
}

/**
 * 步骤 · 视频解说：选择音色与语速档位，提交视频解说任务并轮询进度，
 * 成功后展示成品解说视频与字幕下载。
 */
export function SceneNarrationVideoStep({ factory }: SceneNarrationVideoStepProps) {
  const navigate = useNavigate()
  const { isSubmitting } = factory
  const percent = Math.round(factory.progress * 100)
  const hasVoices = factory.voices.length > 0
  const task = factory.task

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>视频解说</CardTitle>
        <CardDescription>
          为解说生成的分镜解说选择音色与语速档位，合成带画面、配音与字幕的解说视频。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">选择音色</span>
          {factory.isLoadingVoices ? (
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          ) : factory.isVoicesError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-destructive">音色列表加载失败，请重试。</p>
              <Button variant="outline" size="sm" onClick={factory.refetchVoices}>
                重试
              </Button>
            </div>
          ) : hasVoices ? (
            <ToggleGroup
              value={factory.voiceId ? [factory.voiceId] : []}
              onValueChange={(value) => factory.selectVoice(value[0] ?? '')}
              className="flex-wrap"
            >
              {factory.voices.map((voice) => (
                <ToggleGroupItem
                  key={voice.id}
                  value={voice.id}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  {voice.resourceName}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                暂无音色，请先创建音色后再合成。
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/voice-training-v2')}
              >
                去创建音色
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">语速档位</span>
          <ToggleGroup
            value={[factory.speedMode]}
            onValueChange={(value) => {
              const next = value[0]
              if (isSpeedMode(next)) factory.setSpeedMode(next)
            }}
            className="flex-wrap"
          >
            {VOICE_SPEED_MODES.map((mode) => (
              <ToggleGroupItem
                key={mode.value}
                value={mode.value}
                variant="outline"
                disabled={isSubmitting}
              >
                {mode.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={!factory.voiceId || !factory.canSubmit || isSubmitting}
          onClick={factory.submit}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isSubmitting ? '合成中…' : factory.videoUrl ? '重新合成' : '合成解说视频'}
        </Button>

        {factory.status === 'pending' ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.queuePosition ?? '-'} 位
              {factory.queueDepth > 0 ? ` · 前方 ${factory.waitingAhead} 个任务` : ''}
            </span>
          </div>
        ) : null}

        {factory.status === 'running' ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.stageLabel || '合成中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.status === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>合成失败</AlertTitle>
            <AlertDescription>{factory.errorMessage || '请稍后重试。'}</AlertDescription>
          </Alert>
        ) : null}

        {factory.videoUrl ? (
          <div className="flex flex-col gap-3">
            <VideoResult src={factory.videoUrl} title={task?.title || '解说视频'} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {task && task.segmentStates.length > 0 ? (
                <span className="tabular-nums">共 {task.segmentStates.length} 段配音</span>
              ) : null}
              {task && task.cueCount > 0 ? (
                <span className="tabular-nums">字幕 {task.cueCount} 条</span>
              ) : null}
              {factory.srtUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-icon="inline-start"
                  render={<a href={factory.srtUrl} download />}
                >
                  <Download />
                  下载字幕
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <StepFooter onPrev={factory.goPrev} />
      </CardFooter>
    </Card>
  )
}
