import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { MAX_SCRIPT_LENGTH } from '@/constant/synthesis'
import { cn } from '@/lib/utils'

import type { ScriptStageController } from './controller'
import { StepFooter } from './StepFooter'

interface ScriptStepProps {
  factory: ScriptStageController
}

/** 步骤 · 文案：输入待合成文案 */
export function ScriptStep({ factory }: ScriptStepProps) {
  const isOverLimit = factory.script.length >= MAX_SCRIPT_LENGTH

  return (
    <Card>
      <CardHeader>
        <CardTitle>文案</CardTitle>
        <CardDescription>
          输入待合成的文案，字符数需小于 {MAX_SCRIPT_LENGTH}。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={factory.script}
          onChange={(event) => factory.setScript(event.target.value)}
          placeholder="请输入视频文案…"
          className="min-h-72 resize-y"
        />
        <span
          className={cn(
            'self-end text-xs tabular-nums',
            isOverLimit ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {factory.script.length} / {MAX_SCRIPT_LENGTH}
        </span>
      </CardContent>
      <CardFooter>
        <StepFooter onNext={factory.goNext} nextDisabled={!factory.hasValidScript} />
      </CardFooter>
    </Card>
  )
}
