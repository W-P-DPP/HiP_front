import { useState } from 'react'
import { Check, ImagePlus, RotateCw, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { DigitalHumanAvatarDialog } from '@/components/DigitalHumanAvatarDialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUserStore } from '@/store/user'
import type { DigitalHumanAvatar } from '@/types/digital-human'
import { formatDuration } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

import { StepFooter } from '../stages/StepFooter'

/** 形象选择步骤所需的控制器切片 */
interface AvatarStepController {
  avatars: DigitalHumanAvatar[]
  isLoadingAvatars: boolean
  isAvatarsError: boolean
  refetchAvatars: () => void
  avatarId: string
  setAvatarId: (value: string) => void
  goPrev: () => void
  goNext: () => void
}

interface AvatarStepProps {
  factory: AvatarStepController
}

/** 步骤 · 数字人形象：卡片网格单选，支持在此上传新形象 */
export function AvatarStep({ factory }: AvatarStepProps) {
  const userId = useUserStore((state) => state.userId)
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

  const hasAvatars = factory.avatars.length > 0

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader>
        <CardTitle>数字人形象</CardTitle>
        <CardDescription>选择用于本次合成出镜的数字人形象。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {hasAvatars ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              data-icon="inline-start"
              onClick={() => setCreateOpen(true)}
            >
              <ImagePlus />
              上传新形象
            </Button>
            <Button
              variant="ghost"
              data-icon="inline-start"
              onClick={() => navigate('/digital-human')}
            >
              <Settings2 />
              管理数字人
            </Button>
          </div>
        ) : null}

        {factory.isLoadingAvatars ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <Skeleton className="aspect-video w-full xl" />
            <Skeleton className="aspect-video w-full xl" />
            <Skeleton className="aspect-video w-full xl" />
          </div>
        ) : factory.isAvatarsError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-destructive">数字人形象列表加载失败，请重试。</p>
            <Button
              variant="outline"
              size="sm"
              data-icon="inline-start"
              onClick={factory.refetchAvatars}
            >
              <RotateCw />
              重试
            </Button>
          </div>
        ) : hasAvatars ? (
          <ToggleGroup
            value={factory.avatarId ? [factory.avatarId] : []}
            onValueChange={(value) => factory.setAvatarId(value[0] ?? '')}
            className="grid w-full grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-4"
          >
            {factory.avatars.map((avatar) => (
              <ToggleGroupItem
                key={avatar.id}
                value={avatar.id}
                variant="outline"
                className="h-auto flex-col items-stretch justify-start gap-2 p-2 aria-pressed:border-primary aria-pressed:ring-[3px] aria-pressed:ring-ring/30"
              >
                <video
                  src={`${resolveMediaUrl(avatar.referenceUrl)}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full rounded-lg bg-black object-cover"
                />
                <span className="flex items-center justify-between gap-2 px-1 pb-1">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="w-full truncate text-sm font-medium">
                      {avatar.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(avatar.sourceDuration)}
                    </span>
                  </span>
                  {factory.avatarId === avatar.id ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <div className="flex flex-col items-center gap-4 xl border border-border bg-muted/40 px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center xl bg-background">
              <ImagePlus className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">暂无数字人形象</p>
              <p className="text-sm text-muted-foreground">
                上传一段不少于 5 秒的真人视频，即可创建数字人形象。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button data-icon="inline-start" onClick={() => setCreateOpen(true)}>
                <ImagePlus />
                上传新形象
              </Button>
              <Button
                variant="ghost"
                data-icon="inline-start"
                onClick={() => navigate('/digital-human')}
              >
                <Settings2 />
                管理数字人
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <StepFooter
          onPrev={factory.goPrev}
          onNext={factory.goNext}
          nextDisabled={!factory.avatarId}
        />
      </CardFooter>

      <DigitalHumanAvatarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        userId={userId}
        onCreated={(avatar) => {
          // 新建后直接选中，省掉回到网格里再点一次
          factory.setAvatarId(avatar.id)
          factory.refetchAvatars()
        }}
      />
    </Card>
  )
}
