import { Clapperboard, Download } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface VideoResultProps {
  /** 视频地址 */
  src: string
  /** 视频标题 */
  title?: string
}

/** 合成成品视频结果卡片：展示可播放的视频与状态徽标，并支持下载 */
export function VideoResult({ src, title = '成品视频' }: VideoResultProps) {
  return (
    <div className="flex flex-col gap-3 xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
          <Clapperboard className="size-4" />
        </span>
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary">已生成</Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          data-icon="inline-start"
          render={<a href={src} download />}
        >
          <Download />
          下载
        </Button>
      </div>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-lg bg-black object-contain"
      />
    </div>
  )
}
