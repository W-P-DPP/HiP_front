import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { VIDEO_FACTORY_STEPS } from '@/constant/video-factory'
import { useVideoFactory } from '@/hooks/use-video-factory'
import type { VideoFactorySeed } from '@/types/workbench'

import { ScriptStep } from './stages/ScriptStep'
import { SubtitleStep } from './stages/SubtitleStep'
import { VoiceSynthesisStep } from './stages/VoiceSynthesisStep'
import { KeywordStep } from './videoFactory/KeywordStep'
import { VideoSynthesisStep } from './videoFactory/VideoSynthesisStep'

/** 视频工厂：五步向导（文案 → 音频合成 → 字幕生成 → 关键词生成 → 视频合成） */
export function ShortVideoFactoryPage() {
  const navigate = useNavigate()
  // 从短视频合成记录跳转时携带预填参数，直接落到对应步骤并复用已有产物
  const { state } = useLocation()
  const seed = (state as { seed?: VideoFactorySeed } | null)?.seed
  const factory = useVideoFactory(seed)

  const renderStep = () => {
    switch (factory.step) {
      case 0:
        return <ScriptStep factory={factory} />
      case 1:
        return <VoiceSynthesisStep factory={factory} />
      case 2:
        return <SubtitleStep factory={factory} />
      case 3:
        return <KeywordStep factory={factory} />
      default:
        return <VideoSynthesisStep factory={factory} />
    }
  }

  const stepProps = {
    steps: VIDEO_FACTORY_STEPS,
    current: factory.step,
    onStepClick: factory.goToStep,
    isStepDisabled: (index: number) => !factory.canEnterStep(index),
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Button
        variant="ghost"
        data-icon="inline-start"
        className="w-fit"
        onClick={() => navigate('/work-room')}
      >
        <ArrowLeft />
        返回工作台
      </Button>

      <div className="flex flex-1 gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="lg:hidden">
            <Stepper {...stepProps} />
          </div>
          {renderStep()}
        </div>

        <aside className="hidden w-44 shrink-0 lg:block">
          <div className="sticky top-1/2 -translate-y-1/2">
            <Stepper {...stepProps} orientation="vertical" />
          </div>
        </aside>
      </div>
    </div>
  )
}
