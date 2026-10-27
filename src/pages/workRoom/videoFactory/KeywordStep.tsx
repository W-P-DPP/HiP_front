import { useState } from 'react'
import { Library, Plus, Trash2, X } from 'lucide-react'

import { ConfirmPopover } from '@/components/ConfirmPopover'
import { MaterialPickerDialog } from '@/components/MaterialPickerDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { VideoFactoryController } from '@/hooks/use-video-factory'
import type { VideoMaterial } from '@/types/video-material'
import { parseSrt } from '@/utils/srt'

import { StepFooter } from '../stages/StepFooter'

interface KeywordStepProps {
  factory: VideoFactoryController
}

/** 步骤四 · 关键词生成：默认取自字幕内容，可从素材库选择或手动增删 */
export function KeywordStep({ factory }: KeywordStepProps) {
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  // 关键词最多与字幕条数一致，剩余可新增数 = 字幕条数 − 现有数量
  const subtitleCount = parseSrt(factory.subtitle).length
  const remainingSlots = Math.max(0, subtitleCount - factory.keywords.length)

  const handleAdd = () => {
    factory.addKeyword(input)
    setInput('')
  }

  // 把所选素材的关键词追加到关键词区（去重），与手动添加行为一致
  const handlePickMaterials = (materials: VideoMaterial[]) => {
    factory.appendKeywords(materials.map((material) => material.keyword))
  }

  return (
    <>
      <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
        <CardHeader>
          <CardTitle>关键词生成</CardTitle>
          <CardDescription>
            默认以字幕内容作为关键词，也可从素材库选择或手动增删。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              关键词（{factory.keywords.length} / {subtitleCount}）
            </span>
            <div className="flex items-center gap-2">
              {factory.keywords.length > 0 ? (
                <ConfirmPopover
                  title="清空关键词"
                  description={`确定清空全部 ${factory.keywords.length} 个关键词？`}
                  confirmText="清空"
                  onConfirm={factory.clearKeywords}
                >
                  <Trash2 />
                </ConfirmPopover>
              ) : null}
              <Button
                variant="outline"
                data-icon="inline-start"
                disabled={remainingSlots === 0}
                onClick={() => setPickerOpen(true)}
              >
                <Library />
                从素材库选择
              </Button>
            </div>
          </div>

          {factory.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {factory.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="h-7 gap-1 pr-1 text-sm">
                  {keyword}
                  <button
                    type="button"
                    aria-label={`删除关键词 ${keyword}`}
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onClick={() => factory.removeKeyword(keyword)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无关键词，请手动添加。</p>
          )}

          {remainingSlots > 0 ? (
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAdd()
                }}
                placeholder="添加关键词"
                className="w-56"
              />
              <Button
                variant="outline"
                data-icon="inline-start"
                disabled={!input.trim()}
                onClick={handleAdd}
              >
                <Plus />
                添加
              </Button>
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <StepFooter
            onPrev={factory.goPrev}
            onNext={factory.goNext}
            nextDisabled={factory.keywords.length === 0}
          />
        </CardFooter>
      </Card>

      <MaterialPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        maxCount={remainingSlots}
        onConfirm={handlePickMaterials}
      />
    </>
  )
}
