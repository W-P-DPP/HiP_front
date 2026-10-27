import type { StepperStep } from '@/components/Stepper'

/** 视频工厂流程步骤（顺序即步骤条展示顺序） */
export const VIDEO_FACTORY_STEPS: readonly StepperStep[] = [
  { title: '文案', description: '输入待合成文案' },
  { title: '音频合成', description: '选择音色并合成' },
  { title: '字幕生成', description: '生成 SRT 字幕' },
  { title: '关键词生成', description: '提取视频关键词' },
  { title: '视频合成', description: '合成成品视频' },
]
