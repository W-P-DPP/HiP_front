/** 画面理解（LLM 依据场景图像识别结果归纳） */
export interface UnderstandingVisual {
  /** 画面描述 */
  description: string
  /** 画面主要物体 / 人物 */
  objects: string[]
  /** 正在发生的动作（无则为空串） */
  action: string
}

/** 音频理解（LLM 依据场景转写文本归纳） */
export interface UnderstandingAudio {
  /** 该片段的台词 / 语音文本（无则为空串） */
  text: string
}

/** 一条视频理解中间层片段（时间均为毫秒） */
export interface VideoUnderstandingSegment {
  /** 片段开始时间（毫秒） */
  start: number
  /** 片段结束时间（毫秒） */
  end: number
  /** 画面理解 */
  visual: UnderstandingVisual
  /** 音频理解 */
  audio: UnderstandingAudio
}
