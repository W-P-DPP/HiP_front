import { FileText, Loader2, TriangleAlert } from 'lucide-react'

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
import { parseSrt } from '@/utils/srt'

import { AudioResult } from './AudioResult'
import type { SubtitleStageController } from './controller'
import { StepFooter } from './StepFooter'

interface SubtitleStepProps {
  factory: SubtitleStageController
}

/** 步骤 · 字幕生成：基于上一步音频生成 SRT 字幕 */
export function SubtitleStep({ factory }: SubtitleStepProps) {
  const cues = parseSrt(factory.subtitle)
  const percent = Math.round(factory.subtitleProgress * 100)

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>字幕生成</CardTitle>
        <CardDescription>基于上一步合成的音频生成 SRT 字幕。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {factory.audioUrl ? (
          <AudioResult src={factory.audioUrl} title="上一步合成音频" />
        ) : null}

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={factory.isGeneratingSubtitle}
          onClick={factory.generateSubtitle}
        >
          {factory.isGeneratingSubtitle ? <Loader2 className="animate-spin" /> : <FileText />}
          {factory.isGeneratingSubtitle ? '生成中…' : '生成字幕'}
        </Button>

        {factory.subtitleStatus === 'pending' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.subtitleQueuePosition ?? '-'} 位
              {factory.subtitleQueueDepth > 0 ? ` · 前方 ${factory.subtitleWaitingAhead} 个任务` : ''}
            </span>
          </div>
        ) : null}

        {factory.subtitleStatus === 'running' ? (
          <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.subtitleStageLabel || '生成中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.subtitleStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>生成失败</AlertTitle>
            <AlertDescription>{factory.subtitleError || '请稍后重试。'}</AlertDescription>
          </Alert>
        ) : null}

        {factory.isGeneratingSubtitle ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : cues.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {cues.map((cue) => (
              <li
                key={cue.index}
                className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3"
              >
                <span className="text-xs tabular-nums text-muted-foreground">{cue.time}</span>
                <span className="text-sm">{cue.text}</span>
              </li>
            ))}
          </ol>
        ) : factory.subtitle ? (
          <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            {factory.subtitle}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            尚未生成字幕，点击上方按钮开始生成。
          </p>
        )}
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={!factory.subtitle}
        />
      </CardFooter>
    </Card>
  )
}
