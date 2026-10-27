/** 单条字幕（SRT cue） */
export interface SrtCue {
  index: number
  /** 时间轴原文，如 00:00:01,000 --> 00:00:03,000 */
  time: string
  /** 字幕文本（多行以换行拼接） */
  text: string
}

/** 时间轴行标识 */
const TIMELINE_ARROW = '-->'

/**
 * 把 SRT 文本解析为字幕条目，仅用于预览展示。
 * 解析不出任何条目（格式异常）时返回空数组，调用方回退显示原文。
 */
export function parseSrt(content: string): SrtCue[] {
  if (!content) return []

  const blocks = content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  const cues: SrtCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    // 序号行可选：仅当首行是纯数字时才算序号
    const hasIndexLine = /^\d+$/.test(lines[0]?.trim() ?? '')
    const bodyLines = hasIndexLine ? lines.slice(1) : lines
    const timeLineIndex = bodyLines.findIndex((line) => line.includes(TIMELINE_ARROW))
    if (timeLineIndex === -1) continue

    cues.push({
      index: hasIndexLine ? Number(lines[0].trim()) : cues.length + 1,
      time: bodyLines[timeLineIndex].trim(),
      text: bodyLines
        .slice(timeLineIndex + 1)
        .join('\n')
        .trim(),
    })
  }
  return cues
}
