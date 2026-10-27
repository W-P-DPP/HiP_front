import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import { formatClockMs } from '@/utils/format'
import { StepFooter } from '../stages/StepFooter'
import type { SceneUnderstandStageController } from './controller'
import { LlmGenerationForm } from './LlmGenerationForm'

/** 单条视频理解中间层片段：时间范围 + 画面理解 + 台词 */
function SegmentCard({
  segment,
  order,
}: {
  segment: VideoUnderstandingSegment
  order: number
}) {
  const { visual, audio } = segment
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">片段 {order}</span>
        <span className="tabular-nums">
          {formatClockMs(segment.start)} – {formatClockMs(segment.end)}
        </span>
      </div>

      <p className="text-sm">{visual.description || '—'}</p>

      {visual.objects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">物体</span>
          {visual.objects.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      ) : null}

      {visual.action ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">动作</span>
          <Badge variant="outline">{visual.action}</Badge>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">台词</span>
        <p className="text-sm">{audio.text || '—'}</p>
      </div>
    </div>
  )
}

interface SceneUnderstandStepProps {
  factory: SceneUnderstandStageController
}

/**
 * 步骤 · 视频理解：把场景图像识别结果 + 场景转写文本拼成 prompt，
 * 复用 /aiChat 流式对话接口调用大模型，生成结构化的视频理解中间层并展示。
 */
export function SceneUnderstandStep({ factory }: SceneUnderstandStepProps) {
  const hasResult = factory.segments !== null || factory.rawText !== ''
  const isDone = factory.status === 'success' && factory.segments !== null

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>视频理解</CardTitle>
        <CardDescription>
          把场景图像识别结果与场景转写文本交给大模型，生成结构化的视频理解中间层（按语义切分的时间片段 + 画面理解 + 台词）。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LlmGenerationForm controller={factory} hasResult={hasResult} />

        {factory.segments ? (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">
              视频理解中间层（{factory.segments.length} 个片段）
            </span>
            {factory.segments.map((segment, index) => (
              <SegmentCard
                key={`${segment.start}-${segment.end}`}
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
          nextDisabled={!isDone}
        />
      </CardFooter>
    </Card>
  )
}
