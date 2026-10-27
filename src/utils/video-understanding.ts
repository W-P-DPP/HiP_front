import type { SceneSplitScene } from '@/types/scene-split'
import type { SceneTranscribeSceneSegments } from '@/types/scene-transcribe'
import type { VlmBatchItem } from '@/types/vlm-batch'
import type { VideoUnderstandingSegment } from '@/types/video-understanding'
import { formatClockMs } from '@/utils/format'
import { extractJson, toNumber, toText, toStringArray } from '@/utils/llm-json'

/** 默认指令：留空提示词时使用，要求按语义切分并输出固定 JSON 结构 */
export const DEFAULT_UNDERSTANDING_PROMPT = [
  '你是一名视频内容分析助手。请根据下面提供的「场景时间轴 + 画面识别结果 + 语音转写文本」，',
  '把视频归纳为若干语义连贯的片段，并为每个片段生成结构化的视频理解结果。',
  '要求：',
  '1. 按内容语义切分片段；片段的 start / end 为毫秒整数，需落在视频时间范围内且首尾相接、互不重叠；',
  '2. visual.description 用一句话概括画面；visual.objects 为画面主要物体/人物；visual.action 为正在发生的动作（无则空串）；',
  '3. audio.text 为该片段的台词/语音文本（无则空串）；',
  '4. 只输出一个 JSON 数组，不要输出任何解释文字或 Markdown 代码块。',
  '',
  'JSON 结构：',
  '[{"start":9000,"end":20000,"visual":{"description":"男子发现桌上的神秘盒子","objects":["男子","木桌","盒子"],"action":"男子打开盒子"},"audio":{"text":"我不知道为什么这个盒子会出现在这里……"}}]',
].join('\n')

/** 汇总单个场景的画面识别描述（合并该场景各帧的结构化结果） */
function buildSceneVisual(items: readonly VlmBatchItem[]): string {
  const parts: string[] = []
  items.forEach((item) => {
    const result = item.result
    if (!result) return
    const objects = result.objects.length > 0 ? `物体：${result.objects.join('、')}` : ''
    const actions = result.actions.length > 0 ? `动作：${result.actions.join('、')}` : ''
    const line = [result.description, objects, actions].filter(Boolean).join('；')
    if (line) parts.push(line)
  })
  return parts.length > 0 ? parts.join(' | ') : '（无画面识别结果）'
}

/** 汇总单个场景的台词文本（拼接该场景各转写分段） */
function buildSceneText(segments: SceneTranscribeSceneSegments | undefined): string {
  if (!segments) return '（无转写文本）'
  const text = segments.segments
    .map((segment) => segment.text)
    .filter((value) => value.trim() !== '')
    .join(' ')
  return text || '（无转写文本）'
}

/** 把场景时间轴 + 画面识别 + 转写文本渲染成 LLM 可读的数据上下文 */
function buildSceneContext(
  scenes: readonly SceneSplitScene[],
  itemsByScene: ReadonlyMap<number, VlmBatchItem[]>,
  sceneSegments: readonly SceneTranscribeSceneSegments[],
): string {
  const segmentsByScene = new Map(sceneSegments.map((item) => [item.index, item]))
  const lines: string[] = []
  scenes.forEach((scene) => {
    lines.push(
      `场景 ${scene.index}：[${scene.startMs}ms ~ ${scene.endMs}ms]（${formatClockMs(scene.startMs)} ~ ${formatClockMs(scene.endMs)}）`,
    )
    lines.push(`  画面：${buildSceneVisual(itemsByScene.get(scene.index) ?? [])}`)
    lines.push(`  台词：${buildSceneText(segmentsByScene.get(scene.index))}`)
  })
  return lines.join('\n')
}

/**
 * 组装视频理解生成的 prompt：用户指令（留空用默认）在前，自动追加的场景数据上下文在后。
 */
export function buildUnderstandingPrompt(
  userPrompt: string,
  scenes: readonly SceneSplitScene[],
  itemsByScene: ReadonlyMap<number, VlmBatchItem[]>,
  sceneSegments: readonly SceneTranscribeSceneSegments[],
): string {
  const instruction = userPrompt.trim() || DEFAULT_UNDERSTANDING_PROMPT
  const context = buildSceneContext(scenes, itemsByScene, sceneSegments)
  return [
    instruction,
    '',
    '【视频数据】',
    context,
    '',
    '请严格按上述 JSON 结构输出结果（仅 JSON 数组）。',
  ].join('\n')
}

/** 把单条原始对象规整为中间层片段；缺少合法 start / end 时返回 null */
function normalizeSegment(raw: unknown): VideoUnderstandingSegment | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const start = toNumber(record.start)
  const end = toNumber(record.end)
  if (start === null || end === null) return null

  const visual =
    typeof record.visual === 'object' && record.visual !== null
      ? (record.visual as Record<string, unknown>)
      : {}
  const audio =
    typeof record.audio === 'object' && record.audio !== null
      ? (record.audio as Record<string, unknown>)
      : {}

  return {
    start,
    end,
    visual: {
      description: toText(visual.description),
      objects: toStringArray(visual.objects),
      action: toText(visual.action),
    },
    audio: { text: toText(audio.text) },
  }
}

/**
 * 从 LLM 返回文本里解析视频理解中间层：去围栏 → 截取首尾方括号 → JSON.parse →
 * 逐项规整校验。无法解析或无有效片段时返回 null（调用方回退展示原始文本）。
 */
export function parseUnderstandingSegments(
  text: string,
): VideoUnderstandingSegment[] | null {
  if (!text) return null
  const parsed = extractJson(text, '[', ']')
  if (!Array.isArray(parsed)) return null

  const segments = parsed
    .map(normalizeSegment)
    .filter((segment): segment is VideoUnderstandingSegment => segment !== null)
  return segments.length > 0 ? segments : null
}
