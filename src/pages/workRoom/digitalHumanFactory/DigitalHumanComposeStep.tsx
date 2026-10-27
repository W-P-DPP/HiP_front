import type { ReactNode } from 'react'
import { Bot, Loader2, Sparkles, TriangleAlert } from 'lucide-react'

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
import type { DigitalHumanComposeStatus } from '@/hooks/use-digital-human-compose'
import { parseSrt } from '@/utils/srt'

import { StepFooter } from '../stages/StepFooter'
import { VideoResult } from '../stages/VideoResult'

/** 数字人合成步骤所需的控制器切片 */
interface DigitalHumanComposeStepController {
  script: string
  voiceName: string
  avatarName: string
  subtitle: string
  videoUrl: string
  isComposingVideo: boolean
  canComposeVideo: boolean
  videoStatus: DigitalHumanComposeStatus
  videoQueuePosition: number | null
  videoWaitingAhead: number
  videoQueueDepth: number
  videoProgress: number
  videoStageLabel: string
  videoError: string
  composeVideo: () => void
  goPrev: () => void
}

interface DigitalHumanComposeStepProps {
  factory: DigitalHumanComposeStepController
}

interface SummaryItemProps {
  label: string
  children: ReactNode
}

/** 前序结果摘要项 */
function SummaryItem({ label, children }: SummaryItemProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

/** 步骤 · 数字人视频合成：确认前序结果并合成成品视频（末步，无下一步） */
export function DigitalHumanComposeStep({ factory }: DigitalHumanComposeStepProps) {
  const cueCount = parseSrt(factory.subtitle).length
  const percent = Math.round(factory.videoProgress * 100)

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>数字人视频合成</CardTitle>
        <CardDescription>
          确认前序结果，合成带字幕的数字人视频（音频与字幕由后端按文案重建）。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryItem label="文案">
            <span className="line-clamp-2">{factory.script}</span>
          </SummaryItem>
          <SummaryItem label="音色">{factory.voiceName || '--'}</SummaryItem>
          <SummaryItem label="数字人形象">{factory.avatarName || '--'}</SummaryItem>
          <SummaryItem label="字幕">{cueCount} 条</SummaryItem>
        </div>

        <Button
          className="w-fit"
          data-icon="inline-start"
          disabled={!factory.canComposeVideo || factory.isComposingVideo}
          onClick={factory.composeVideo}
        >
          {factory.isComposingVideo ? <Loader2 className="animate-spin" /> : <Bot />}
          {factory.isComposingVideo ? '合成中…' : factory.videoUrl ? '重新合成' : '视频合成'}
        </Button>

        {factory.videoStatus === 'pending' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-sm">
              排队中 · 当前第 {factory.videoQueuePosition ?? '-'} 位
              {factory.videoQueueDepth > 0 ? ` · 前方 ${factory.videoWaitingAhead} 个任务` : ''}
            </span>
          </div>
        ) : null}

        {factory.videoStatus === 'running' ? (
          <div className="flex flex-col gap-2 xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span>{factory.videoStageLabel || '合成中'}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
          </div>
        ) : null}

        {factory.videoStatus === 'failed' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>合成失败</AlertTitle>
            <AlertDescription>{factory.videoError || '请稍后重试。'}</AlertDescription>
          </Alert>
        ) : null}

        {factory.isComposingVideo ? (
          <Skeleton className="aspect-video w-full xl" />
        ) : factory.videoUrl ? (
          <VideoResult src={factory.videoUrl} title="数字人成品视频" />
        ) : factory.videoStatus === 'idle' || factory.videoStatus === 'cancelled' ? (
          <div className="flex items-center gap-3 xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Sparkles className="size-4 shrink-0" />
            确认前序结果后，点击上方按钮开始合成。
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <StepFooter onPrev={factory.goPrev} />
      </CardFooter>
    </Card>
  )
}
