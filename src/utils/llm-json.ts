/** 去除 Markdown 代码块围栏（```json ... ```） */
export function stripCodeFence(text: string): string {
  return text.replace(/```[a-zA-Z]*/g, '').trim()
}

/** 宽松转数字：数字或数字字符串，非法返回 null */
export function toNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** 宽松转字符串：非字符串返回空串 */
export function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 宽松转字符串数组：非数组返回空数组，逐项过滤非字符串 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * 从 LLM 返回文本里截取定界符之间的 JSON 并解析（去围栏 → 首个 open 到末个 close）。
 * 找不到定界符或解析失败时返回 undefined。
 */
export function extractJson(text: string, open: string, close: string): unknown {
  const cleaned = stripCodeFence(text)
  const start = cleaned.indexOf(open)
  const end = cleaned.lastIndexOf(close)
  if (start === -1 || end <= start) return undefined
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return undefined
  }
}
