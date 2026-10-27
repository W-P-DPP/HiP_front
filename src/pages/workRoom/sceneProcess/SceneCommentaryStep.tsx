import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { CommentarySegment } from '@/types/video-commentary'
import { formatClockMs } from '@/utils/format'
import { StepFooter } from '../stages/StepFooter'
import type { SceneCommentaryStageController } from './controller'
import { LlmGenerationForm } from './LlmGenerationForm'

/** 单条分镜解说：时间范围 + 解说词 + 语气/情绪 */
function CommentarySegmentCard({
  segment,
  order,
}: {
  segment: CommentarySegment
  order: number
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">片段 {order}</span>
        <span className="tabular-nums">
          {formatClockMs(segment.start)} – {formatClockMs(segment.end)}
        </span>
        {segment.emotion ? (
          <Badge variant="outline">{segment.emotion}</Badge>
        ) : null}
      </div>
      <p className="text-sm">{segment.text || '—'}</p>

      {segment.clips.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <span className="text-xs text-muted-foreground">配画面片段</span>
          {segment.clips.map((clip, index) => (
            <div
              key={`${clip.start}-${clip.end}-${index}`}
              className="flex flex-col gap-0.5"
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatClockMs(clip.start)} – {formatClockMs(clip.end)}
              </span>
              {clip.description ? (
                <span className="text-sm">{clip.description}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface SceneCommentaryStepProps {
  factory: SceneCommentaryStageController
}

/**
 * 步骤 · 解说生成：以视频理解的分段结果为输入，复用 /aiChat 流式对话接口调用大模型，
 * 生成结构化解说（整段标题/总述 + 分镜解说词与语气）并展示。
 */
export function SceneCommentaryStep({ factory }: SceneCommentaryStepProps) {
  const commentary = factory.commentary
  const hasResult = commentary !== null || factory.rawText !== ''

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>解说生成</CardTitle>
        <CardDescription>
          根据视频理解结果调用大模型生成解说（标题、总述、分镜解说词与语气），并为每个分镜挑选用于配画面的原片关键片段。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LlmGenerationForm controller={factory} hasResult={hasResult} />

        {commentary ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/40 p-4">
              <span className="text-sm font-medium">{commentary.title || '解说'}</span>
              {commentary.summary ? (
                <p className="text-sm text-muted-foreground">{commentary.summary}</p>
              ) : null}
            </div>

            <span className="text-sm font-medium">
              分镜解说（{commentary.segments.length} 段）
            </span>
            {commentary.segments.map((segment, index) => (
              <CommentarySegmentCard
                key={`${segment.start}-${segment.end}-${index}`}
                segment={segment}
                order={index + 1}
              />
            ))}
          </div>
        ) : factory.rawText && !factory.isGenerating ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">模型原始返回</span>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 font-mono text-xs">
              {factory.rawText}
            </pre>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={commentary === null}
        />
      </CardFooter>
    </Card>
  )
}
