import type {
  CommentaryClip,
  CommentarySegment,
  VideoCommentary,
} from '@/types/video-commentary'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import { formatClockMs } from '@/utils/format'
import { extractJson, toNumber, toText } from '@/utils/llm-json'

/** 默认指令：留空提示词时使用，要求按分镜输出解说并挑选配画面原片段 */
export const DEFAULT_COMMENTARY_PROMPT = [
  '你是一名视频解说撰稿人。请根据下面提供的「视频理解结果」（每个片段的画面描述、动作与台词），',
  '为整段视频撰写解说，并为每条解说挑选用于配画面的原片关键片段。',
  '要求：',
  '1. 可以在不改变剧情的前提下，把语义连贯的【相邻】小片段合并成一个较大的解说场景（只能相邻合并，顺序不变）；',
  '2. 输出一个 JSON 对象：title 为解说标题，summary 为整段解说总述；',
  '3. segments 为分镜解说数组，每项含：',
  '   - start / end：该解说场景的时间范围（毫秒整数；合并后取所并各小片段的并集）；',
  '   - text：该场景的解说词（口语化、连贯，不要出现分镜编号或「画面显示」之类的旁白说明）；',
  '   - emotion：该场景解说的语气/情绪；',
  '   - clips：为充实解说视频、补充解说词而挑选的原片关键片段数组，每项含 start / end（毫秒整数，落在本场景时间范围内）与 description（该片段的关键内容说明）；',
  '4. 只输出一个 JSON 对象，不要输出任何解释文字或 Markdown 代码块。',
  '',
  'JSON 结构：',
  '{"title":"神秘盒子","summary":"全片讲述男子发现神秘盒子并打开的过程。","segments":[{"start":9000,"end":32000,"text":"这时，男子在桌上发现了一个神秘的盒子……","emotion":"悬疑","clips":[{"start":12000,"end":18000,"description":"男子拿起盒子端详的特写"}]}]}',
].join('\n')

/** 把视频理解的分段渲染成 LLM 可读的数据上下文 */
function buildSegmentContext(
  segments: readonly VideoUnderstandingSegment[],
): string {
  const lines: string[] = []
  segments.forEach((segment, index) => {
    const { visual, audio } = segment
    lines.push(
      `片段 ${index + 1}：[${segment.start}ms ~ ${segment.end}ms]（${formatClockMs(segment.start)} ~ ${formatClockMs(segment.end)}）`,
    )
    const visualLine = [
      visual.description,
      visual.action ? `动作：${visual.action}` : '',
      visual.objects.length > 0 ? `物体：${visual.objects.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('；')
    lines.push(`  画面：${visualLine || '（无画面描述）'}`)
    lines.push(`  台词：${audio.text || '（无台词）'}`)
  })
  return lines.join('\n')
}

/**
 * 组装解说生成的 prompt：用户指令（留空用默认）在前，自动追加的视频理解数据上下文在后。
 */
export function buildCommentaryPrompt(
  userPrompt: string,
  segments: readonly VideoUnderstandingSegment[],
): string {
  const instruction = userPrompt.trim() || DEFAULT_COMMENTARY_PROMPT
  const context = buildSegmentContext(segments)
  return [
    instruction,
    '',
    '【视频理解结果】',
    context,
    '',
    '请严格按上述 JSON 结构输出结果（仅 JSON 对象）。',
  ].join('\n')
}

/** 把单条原始对象规整为原片关键片段；时间非法时返回 null */
function normalizeClip(raw: unknown): CommentaryClip | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const start = toNumber(record.start)
  const end = toNumber(record.end)
  if (start === null || end === null) return null
  return { start, end, description: toText(record.description) }
}

/** 把单条原始对象规整为解说分镜；文本、语气与原片段都为空时返回 null */
function normalizeSegment(raw: unknown): CommentarySegment | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const text = toText(record.text)
  const emotion = toText(record.emotion)
  const clips = Array.isArray(record.clips)
    ? record.clips
        .map(normalizeClip)
        .filter((clip): clip is CommentaryClip => clip !== null)
    : []
  if (!text && !emotion && clips.length === 0) return null
  return {
    start: toNumber(record.start) ?? 0,
    end: toNumber(record.end) ?? 0,
    text,
    emotion,
    clips,
  }
}

/**
 * 从 LLM 返回文本里解析解构结果：去围栏 → 截取首尾花括号 → JSON.parse → 规整校验。
 * 无法解析或内容为空时返回 null（调用方回退展示原始文本）。
 */
export function parseVideoCommentary(text: string): VideoCommentary | null {
  if (!text) return null
  const parsed = extractJson(text, '{', '}')
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const record = parsed as Record<string, unknown>
  const title = toText(record.title)
  const summary = toText(record.summary)
  const segments = Array.isArray(record.segments)
    ? record.segments
        .map(normalizeSegment)
        .filter((segment): segment is CommentarySegment => segment !== null)
    : []

  if (!title && !summary && segments.length === 0) return null
  return { title, summary, segments }
}
