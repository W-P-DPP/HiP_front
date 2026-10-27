import type { StepperStep } from '@/components/Stepper'
import type { VlmTaskMode } from '@/types/vlm'

/** 场景处理流程步骤（顺序即步骤条展示顺序）：场景切分 → 抽帧 → 场景转写 → 场景图像识别 → 视频理解 → 解说生成 → 视频解说 */
export const SCENE_PROCESS_STEPS: readonly StepperStep[] = [
  { title: '场景切分', description: '切分视频场景' },
  { title: '抽帧', description: '按场景抽取关键帧' },
  { title: '场景转写', description: '转写场景内容' },
  { title: '场景图像识别', description: '识别关键帧画面内容' },
  { title: '视频理解', description: '生成结构化视频理解中间层' },
  { title: '解说生成', description: '根据视频理解生成解说' },
  { title: '视频解说', description: '选择音色合成解说视频' },
]

/** 视频理解步骤下标（第 5 步，依赖场景图像识别完成） */
export const UNDERSTAND_STEP = 4

/** 解说生成步骤下标（第 6 步，依赖视频理解完成） */
export const COMMENTARY_STEP = 5

/** 视频解说步骤下标（第 7 步，依赖解说生成完成） */
export const NARRATION_VIDEO_STEP = 6

/** 关键帧类型的中文标签（抽帧结果与图像识别共用） */
export const FRAME_KIND_LABELS: Record<string, string> = {
  start: '起始帧',
  mid: '中间帧',
  end: '结束帧',
}

/** 图像识别输出模式选项（ToggleGroup 单选） */
export const VLM_MODE_OPTIONS: readonly { value: VlmTaskMode; label: string }[] = [
  { value: 'json', label: 'JSON 结构化' },
  { value: 'text', label: '纯文本' },
]

/** 是否为合法的输出模式（ToggleGroup 的值为 string[]，收窄后写入状态） */
export function isVlmTaskMode(value: string | undefined): value is VlmTaskMode {
  return value === 'json' || value === 'text'
}

/** 检测算法选项；default 表示不传 detector，由后端取推荐值 */
export const DETECTOR_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'content', label: '内容检测' },
  { value: 'adaptive', label: '自适应' },
  { value: 'threshold', label: '阈值' },
] as const

/** 可选数字参数的字段名（与 DetectOptions 的数值字段一一对应） */
export type NumericFieldKey =
  | 'threshold'
  | 'minSceneLenSec'
  | 'downscale'
  | 'frameSkip'
  | 'blackDetectSec'

/** 单个可选数字参数的表单配置 */
export interface NumericFieldConfig {
  key: NumericFieldKey
  label: string
  hint: string
}

/** 五个可选数字参数的表单配置 */
export const NUMERIC_FIELDS: readonly NumericFieldConfig[] = [
  { key: 'threshold', label: '检测阈值', hint: '缺省用该算法的推荐值' },
  { key: 'minSceneLenSec', label: '最短场景时长（秒）', hint: '低于该时长的场景会被合并' },
  { key: 'downscale', label: '降采样倍数', hint: '1 表示不降采样，越大越快' },
  { key: 'frameSkip', label: '隔帧采样数', hint: '0 表示逐帧检测' },
  { key: 'blackDetectSec', label: '首尾黑帧检测（秒）', hint: '裁掉首尾黑场片段的时长，0 表示不检测' },
]

/** 数字参数初值：统一存字符串，允许留空表示走后端默认 */
export const EMPTY_NUMERIC_VALUES: Record<NumericFieldKey, string> = {
  threshold: '',
  minSceneLenSec: '',
  downscale: '',
  frameSkip: '',
  blackDetectSec: '',
}
