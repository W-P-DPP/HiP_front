import type { StepperStep } from '@/components/Stepper'

/**
 * 数字人工厂流程步骤（顺序即步骤条展示顺序）。
 * 前三步与短视频工厂一致；后端按 text + voiceId 重建音频，故不选速度档位。
 */
export const DIGITAL_HUMAN_FACTORY_STEPS: readonly StepperStep[] = [
  { title: '文案', description: '输入待合成文案' },
  { title: '音频合成', description: '选择音色并合成' },
  { title: '字幕生成', description: '生成 SRT 字幕' },
  { title: '数字人形象', description: '选择数字人形象' },
  { title: '视频合成', description: '合成数字人视频' },
]

/** 形象选择步骤拉取当前用户形象列表的分页参数：一次取全量，无需翻页 */
export const AVATAR_LIST_PAGE_SIZE = 9999
