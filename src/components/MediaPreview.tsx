import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AudioLines, ImageOff } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type MediaPreviewType = 'video' | 'audio' | 'image'

interface MediaPreviewProps {
  /** 媒体地址（http/https/blob/data 均可） */
  src: string
  /** 媒体类型；缺省时按 src 扩展名自动推断，无法推断时按图片处理（如 blob 地址请显式传入） */
  type?: MediaPreviewType
  /** 弹框标题，默认取文件名 */
  title?: string
  /** 触发器内容（须为单个元素，如 Button 或缩略图 img）；传了则点击触发预览，不传需用受控 open */
  children?: ReactNode
  /** 受控开关（配合 onOpenChange 使用） */
  open?: boolean
  /** 开关回调 */
  onOpenChange?: (open: boolean) => void
  /** 透传给 DialogContent 的类名（可覆盖宽度） */
  contentClassName?: string
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'oga',
  'm4a',
  'aac',
  'flac',
  'wma',
  'opus',
])

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'mkv',
  'avi',
  'm3u8',
  'flv',
  'ogv',
  'm4v',
])

/** 各媒体类型的弹框宽度预设，覆盖 dialog 默认的 sm:max-w-sm */
const CONTENT_SIZE_CLASS: Record<MediaPreviewType, string> = {
  video: 'sm:max-w-3xl',
  audio: 'sm:max-w-md',
  image: 'sm:max-w-2xl',
}

/** 按 URL 扩展名推断媒体类型，无法识别时默认图片 */
function detectMediaType(src: string): MediaPreviewType {
  const ext =
    src
      .split('?')[0]
      .split('#')[0]
      .toLowerCase()
      .split('.')
      .pop() ?? ''
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  return 'image'
}

/** 从 URL 提取文件名作为默认标题，blob/data 地址无文件名则用占位文案 */
function getMediaTitle(src: string): string {
  if (src.startsWith('data:') || src.startsWith('blob:')) return '媒体预览'
  try {
    const pathname = new URL(src, window.location.origin).pathname
    const name = pathname.split('/').pop()
    if (name) return decodeURIComponent(name)
  } catch {
    // 无法解析的地址走默认占位
  }
  return '媒体预览'
}

/**
 * 媒体预览公共组件：在弹框中播放视频/音频、预览图片。
 * - 支持两种用法：传 children 作为触发器（内部管理开关），或传 open/onOpenChange 受控使用。
 * - 打开时自动播放（音视频），关闭时弹框卸载即停止；加载失败展示错误占位。
 */
export function MediaPreview({
  src,
  type,
  title,
  children,
  open,
  onOpenChange,
  contentClassName,
}: MediaPreviewProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  // 记录加载失败的 src：与当前 src 不一致时视为未失败，天然兼容切换 src 的场景
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const mediaType = type ?? detectMediaType(src)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const resolvedTitle = title ?? getMediaTitle(src)
  const loadFailed = failedSrc === src

  const handleOpenChange = (next: boolean) => {
    // 每次打开重置失败态，允许重新加载重试
    if (next) setFailedSrc(null)
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  let mediaNode: ReactNode
  if (loadFailed) {
    mediaNode = (
      <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
        <ImageOff className="size-10" />
        <p className="text-sm">媒体加载失败，请检查地址是否可用</p>
      </div>
    )
  } else if (mediaType === 'video') {
    mediaNode = (
      <video
        key={src}
        src={src}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="mx-auto max-h-[70dvh] w-full rounded-lg bg-black object-contain"
        onError={() => setFailedSrc(src)}
      />
    )
  } else if (mediaType === 'audio') {
    mediaNode = (
      <div className="flex flex-col items-center gap-6 py-2">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <AudioLines className="size-8" />
        </div>
        <audio
          key={src}
          src={src}
          controls
          autoPlay
          className="w-full"
          onError={() => setFailedSrc(src)}
        />
      </div>
    )
  } else {
    mediaNode = (
      <img
        key={src}
        src={src}
        alt={resolvedTitle}
        className="mx-auto max-h-[70dvh] max-w-full rounded-lg object-contain"
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children as ReactElement} /> : null}
      <DialogContent
        className={cn('overflow-hidden', CONTENT_SIZE_CLASS[mediaType], contentClassName)}
      >
        <DialogHeader className="gap-0.5 pr-8">
          <DialogTitle className="truncate">{resolvedTitle}</DialogTitle>
        </DialogHeader>
        {mediaNode}
      </DialogContent>
    </Dialog>
  )
}
