import {
  Bot,
  Clapperboard,
  MessageSquareText,
  ScanEye,
  Scissors,
  Subtitles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'

/** 工作台：聚合智能对话 / 数字人工厂 / 短视频工厂 / 字幕合成 / 图像理解 / 场景切分入口 */
export function WorkRoomPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button
          size="lg"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/chat')}
        >
          <MessageSquareText />
          智能对话
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/digital-human')}
        >
          <Bot />
          数字人工厂
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/short-video')}
        >
          <Clapperboard />
          短视频工厂
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/subtitle')}
        >
          <Subtitles />
          字幕合成
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/image-understand')}
        >
          <ScanEye />
          图像理解
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-44"
          data-icon="inline-start"
          onClick={() => navigate('/work-room/scene-split')}
        >
          <Scissors />
          AI解说
        </Button>
      </div>
    </div>
  )
}
