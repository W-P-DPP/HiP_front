import { AudioLines } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

interface AudioResultProps {
  /** 音频地址 */
  src: string
  /** 音频标题 */
  title?: string
}

/** 合成音频结果卡片：展示可播放的音频与状态徽标 */
export function AudioResult({ src, title = '合成音频' }: AudioResultProps) {
  return (
    <div className="flex flex-col gap-3 xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
          <AudioLines className="size-4" />
        </span>
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary" className="ml-auto">
          已生成
        </Badge>
      </div>
      <audio src={src} controls className="w-full" />
    </div>
  )
}
