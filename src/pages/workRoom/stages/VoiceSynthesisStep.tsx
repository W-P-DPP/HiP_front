import { Loader2, Sparkles, TriangleAlert } from 'lucide-react'
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

import { AudioResult } from './AudioResult'
import type { VoiceSynthesisStageController } from './controller'
import { StepFooter } from './StepFooter'

interface VoiceSynthesisStepProps {
  factory: VoiceSynthesisStageController
  /** 是否展示速度档位（后端入参不含档位时隐藏，保证字幕时间轴与后端重建音频一致） */
  showSpeedMode?: boolean
}

/** 是否为合法的速度档位（ToggleGroup 的值为 string[]，收窄后写入控制器） */
function isSpeedMode(value: string | undefined): value is VoiceTrainV2SpeedMode {
  return value === 'fast' || value === 'balanced' || value === 'quality'
}

/** 步骤 · 音频合成：选择音色与速度档位，提交合成并轮询进度 */
export function VoiceSynthesisStep({
  factory,
  showSpeedMode = true,
}: VoiceSynthesisStepProps) {
  const navigate = useNavigate()
  const { isSynthesizingAudio } = factory
  const percent = Math.round(factory.synthesisProgress * 100)
  const hasVoices = factory.voices.length > 0

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>音频合成</CardTitle>
        <CardDescription>
          {showSpeedMode
            ? '选择当前用户音色与速度档位，合成文案对应的配音音频。'
            : '选择当前用户音色，合成文案对应的配音音频。'}
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
              onValueChange={(value) => factory.setVoiceId(value[0] ?? '')}
              className="flex-wrap"
            >
              {factory.voices.map((voice) => (
                <ToggleGroupItem
                  key={voice.id}
                  value={voice.id}
                  variant="outline"
                  disabled={isSynthesizingAudio}
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

        {showSpeedMode ? (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">速度档位</span>
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
                  disabled={isSynthesizingAudio}
                >
                  {mode.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ) : null}

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={!factory.voiceId || isSynthesizingAudio}
          onClick={factory.synthesizeAudio}
        >
          {isSynthesizingAudio ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isSynthesizingAudio ? '合成中…' : factory.audioUrl || factory.isAudioStale ? '重新合成' : '合成'}
        </Button>

        {factory.synthesisStatus === 'pending' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.queuePosition ?? '-'} 位
              {factory.queueDepth > 0 ? ` · 前方 ${factory.waitingAhead} 个任务` : ''}
            </span>
          </div>
        ) : null}

        {factory.synthesisStatus === 'running' ? (
          <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.synthesisStageLabel || '合成中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.synthesisStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>合成失败</AlertTitle>
            <AlertDescription>{factory.synthesisError || '请稍后重试。'}</AlertDescription>
          </Alert>
        ) : null}

        {factory.audioUrl ? (
          <AudioResult src={factory.audioUrl} title={factory.voiceName || '合成音频'} />
        ) : factory.isAudioStale ? (
          <p className="text-sm text-muted-foreground">文案或音色已变更，请重新合成。</p>
        ) : null}
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={!factory.audioUrl}
        />
      </CardFooter>
    </Card>
  )
}
