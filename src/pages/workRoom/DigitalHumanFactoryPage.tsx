import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { DIGITAL_HUMAN_FACTORY_STEPS } from '@/constant/digital-human-factory'
import { useDigitalHumanFactory } from '@/hooks/use-digital-human-factory'
import type { DigitalHumanFactorySeed } from '@/types/workbench'

import { AvatarStep } from './digitalHumanFactory/AvatarStep'
import { DigitalHumanComposeStep } from './digitalHumanFactory/DigitalHumanComposeStep'
import { ScriptStep } from './stages/ScriptStep'
import { SubtitleStep } from './stages/SubtitleStep'
import { VoiceSynthesisStep } from './stages/VoiceSynthesisStep'

/** 数字人工厂：五步向导（文案 → 音频合成 → 字幕生成 → 数字人形象 → 视频合成） */
export function DigitalHumanFactoryPage() {
  const navigate = useNavigate()
  // 从数字人合成记录跳转时携带预填参数，直接落到对应步骤并复用已有产物
  const { state } = useLocation()
  const seed = (state as { seed?: DigitalHumanFactorySeed } | null)?.seed
  const factory = useDigitalHumanFactory(seed)

  const renderStep = () => {
    switch (factory.step) {
      case 0:
        return <ScriptStep factory={factory} />
      case 1:
        // 后端按 text + voiceId 重建音频，档位不入参，故不展示速度档位
        return <VoiceSynthesisStep factory={factory} showSpeedMode={false} />
      case 2:
        return <SubtitleStep factory={factory} />
      case 3:
        return <AvatarStep factory={factory} />
      default:
        return <DigitalHumanComposeStep factory={factory} />
    }
  }

  const stepProps = {
    steps: DIGITAL_HUMAN_FACTORY_STEPS,
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
