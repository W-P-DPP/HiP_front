import { Info, Loader2, Sparkles, Square, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { LlmGenerationFormController } from '@/hooks/use-llm-generation'

/** 平台下拉的等待提示 */
const PLATFORM_PLACEHOLDER = '请选择 AI 平台'
/** 模型下拉的等待提示（未选平台前不可选） */
const MODEL_PLACEHOLDER = '请先选择平台'

export interface LlmGenerationFormProps {
  /** 生成表单控制器（平台/模型/提示词/生成动作） */
  controller: LlmGenerationFormController
  /** 是否已有结果（决定按钮显示「重新生成」） */
  hasResult: boolean
}

/**
 * LLM 生成的通用表单：AI 平台 + 模型 + 提示词 + 生成/停止按钮，以及流式预览与错误提示。
 * 「视频理解」「解说生成」等步骤共用，各步只需渲染自己的结果区。
 */
export function LlmGenerationForm({
  controller,
  hasResult,
}: LlmGenerationFormProps) {
  const { platforms, modelOptions } = controller
  const hasPlatform = platforms.length > 0

  return (
    <>
      {!controller.isPlatformsLoading && !hasPlatform ? (
        <Alert>
          <Info />
          <AlertTitle>暂无可用 AI 平台</AlertTitle>
          <AlertDescription>
            请先到「个人资料 → AI 平台配置」添加平台，再回到此处生成。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-platform">AI 平台</Label>
          <Select
            value={controller.accountId || null}
            onValueChange={(value) =>
              controller.setAccountId(typeof value === 'string' ? value : '')
            }
            disabled={controller.isPlatformsLoading || !hasPlatform}
          >
            <SelectTrigger id="llm-platform" className="w-full">
              <SelectValue>
                {(value) => {
                  const key = typeof value === 'string' ? value : ''
                  if (!key) {
                    return (
                      <span className="text-muted-foreground">
                        {PLATFORM_PLACEHOLDER}
                      </span>
                    )
                  }
                  return platforms.find((item) => item._id === key)?.name ?? key
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {platforms.map((platform) => (
                  <SelectItem key={platform._id} value={platform._id}>
                    {platform.name}
                    <span className="font-mono text-xs text-muted-foreground">
                      {platform.defaultModel}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-model">模型</Label>
          <Select
            value={controller.modelName || null}
            onValueChange={(value) =>
              controller.setModelName(typeof value === 'string' ? value : '')
            }
            disabled={!controller.accountId}
          >
            <SelectTrigger id="llm-model" className="w-full">
              <SelectValue>
                {(value) => {
                  const key = typeof value === 'string' ? value : ''
                  if (!key) {
                    return (
                      <span className="text-muted-foreground">
                        {MODEL_PLACEHOLDER}
                      </span>
                    )
                  }
                  return modelOptions.find((model) => model.id === key)?.name ?? key
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {modelOptions.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-prompt">提示词（可选）</Label>
          <Textarea
            id="llm-prompt"
            value={controller.prompt}
            onChange={(event) => controller.setPrompt(event.target.value)}
            placeholder="留空则使用内置默认指令；数据上下文会自动追加"
            disabled={controller.isGenerating}
            rows={4}
          />
        </div>

        {controller.isGenerating ? (
          <Button
            variant="outline"
            className="w-fit"
            data-icon="inline-start"
            onClick={controller.stop}
          >
            <Square />
            停止生成
          </Button>
        ) : (
          <Button
            className="w-fit"
            data-icon="inline-start"
            disabled={!controller.canGenerate}
            onClick={controller.generate}
          >
            <Sparkles />
            {hasResult ? '重新生成' : '开始生成'}
          </Button>
        )}
      </div>

      {controller.isGenerating ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span>生成中…</span>
          </div>
          {controller.streamingText ? (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {controller.streamingText}
            </pre>
          ) : null}
        </div>
      ) : null}

      {!controller.isGenerating && controller.error ? (
        <Alert variant={controller.status === 'failed' ? 'destructive' : 'default'}>
          {controller.status === 'failed' ? <TriangleAlert /> : <Info />}
          <AlertTitle>{controller.status === 'failed' ? '生成失败' : '提示'}</AlertTitle>
          <AlertDescription>{controller.error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
