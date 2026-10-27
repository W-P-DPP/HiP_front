/** 解说配套的原片关键片段（时间均为毫秒） */
export interface CommentaryClip {
  /** 原片片段开始时间（毫秒） */
  start: number
  /** 原片片段结束时间（毫秒） */
  end: number
  /** 该片段的关键内容说明（供选片/配画面参考） */
  description: string
}

/** 单条解说的分镜（时间均为毫秒） */
export interface CommentarySegment {
  /** 场景开始时间（毫秒；合并后为各小片段并集） */
  start: number
  /** 场景结束时间（毫秒） */
  end: number
  /** 该场景的解说词 */
  text: string
  /** 语气 / 情绪 */
  emotion: string
  /** 用于充实解说视频的原片关键片段 */
  clips: CommentaryClip[]
}

/** 结构化解说（LLM 输出） */
export interface VideoCommentary {
  /** 解说标题 */
  title: string
  /** 整段解说总述 */
  summary: string
  /** 分镜解说列表 */
  segments: CommentarySegment[]
}
