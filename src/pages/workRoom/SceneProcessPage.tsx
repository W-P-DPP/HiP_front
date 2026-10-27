import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import {
  COMMENTARY_STEP,
  NARRATION_VIDEO_STEP,
  SCENE_PROCESS_STEPS,
} from '@/constant/scene-process'
import { useSceneProcess } from '@/hooks/use-scene-process'
import type { SceneProcessSeed } from '@/types/workbench'

import { FrameExtractStep } from './sceneProcess/FrameExtractStep'
import { SceneCommentaryStep } from './sceneProcess/SceneCommentaryStep'
import { SceneNarrationVideoStep } from './sceneProcess/SceneNarrationVideoStep'
import { SceneRecognizeStep } from './sceneProcess/SceneRecognizeStep'
import { SceneSplitStep } from './sceneProcess/SceneSplitStep'
import { SceneTranscribeStep } from './sceneProcess/SceneTranscribeStep'
import { SceneUnderstandStep } from './sceneProcess/SceneUnderstandStep'

/** 场景处理：七步向导（场景切分 → 抽帧 → 场景转写 → 场景图像识别 → 视频理解 → 解说生成 → 视频解说） */
export function SceneProcessPage() {
  const navigate = useNavigate()
  // 从场景切分记录跳转时携带预填参数，预载源视频与切分任务并落到切分已完成状态
  const { state } = useLocation()
  const seed = (state as { seed?: SceneProcessSeed } | null)?.seed
  const factory = useSceneProcess(seed)

  const renderStep = () => {
    switch (factory.step) {
      case 0:
        return <SceneSplitStep factory={factory} />
      case 1:
        return <FrameExtractStep factory={factory} />
      case 2:
        return <SceneTranscribeStep factory={factory} />
      case 3:
        return <SceneRecognizeStep factory={factory} />
      case 4:
        // 后三步的控制器字段同名，按步骤取各自的切片并补上步骤导航
        return (
          <SceneUnderstandStep
            factory={{
              ...factory.understanding,
              goPrev: factory.goPrev,
              goNext: factory.goNext,
            }}
          />
        )
      case COMMENTARY_STEP:
        return (
          <SceneCommentaryStep
            factory={{
              ...factory.commentary,
              goPrev: factory.goPrev,
              goNext: factory.goNext,
            }}
          />
        )
      case NARRATION_VIDEO_STEP:
        return (
          <SceneNarrationVideoStep
            factory={{ ...factory.narrationVideo, goPrev: factory.goPrev }}
          />
        )
      default:
        return null
    }
  }

  const stepProps = {
    steps: SCENE_PROCESS_STEPS,
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
