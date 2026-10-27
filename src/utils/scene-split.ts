import { NUMERIC_FIELDS } from '@/constant/scene-process'
import type { NumericFieldKey } from '@/constant/scene-process'
import type { DetectOptions } from '@/types/scene-split'

/** 把表单值收敛为接口入参：留空与非法的字段整体省略，交给后端取推荐值 */
export function buildDetectOptions(
  values: Record<NumericFieldKey, string>,
  detector: string,
): DetectOptions {
  const options: DetectOptions = {}
  if (detector !== 'default') options.detector = detector
  for (const field of NUMERIC_FIELDS) {
    const raw = values[field.key].trim()
    if (!raw) continue
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) continue
    options[field.key] = parsed
  }
  return options
}

/** 非法（非数字 / 负数）的字段名，用于内联报错与禁用提交 */
export function resolveInvalidFieldKeys(
  values: Record<NumericFieldKey, string>,
): NumericFieldKey[] {
  return NUMERIC_FIELDS.filter((field) => {
    const raw = values[field.key].trim()
    if (!raw) return false
    const parsed = Number(raw)
    return !Number.isFinite(parsed) || parsed < 0
  }).map((field) => field.key)
}

/** 合并接口要求每组为连续序号，故选择范围必须连续（跨页但序号相邻仍合法） */
export function isContiguous(indices: readonly number[]): boolean {
  if (indices.length <= 1) return true
  const sorted = [...indices].sort((a, b) => a - b)
  return sorted.every((value, position) => value === sorted[0] + position)
}
