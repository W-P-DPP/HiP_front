/** 训练样本文本段（POST /voiceTrain/texts 返回的 data.textSegs 元素） */
export interface VoiceTrainTextSeg {
  /** 文本段 id */
  segId: number
  /** 文本段内容（用于朗读录制） */
  segText: string
  /** 文本类型（如背景音，当前后端返回空串） */
  segTextType: string
  /** 文本语言（如 zh_cn） */
  segTextLan: string
  /** 排序（升序渲染） */
  segSort: number
}

/** 音色训练样本文本（POST /voiceTrain/texts 返回的 data） */
export interface VoiceTrainText {
  /** 文本库 id */
  textId: number
  /** 文本库名称 */
  textName: string
  /** 训练样本分段列表 */
  textSegs: VoiceTrainTextSeg[]
  /** 全量拼接文本（后端字段原名） */
  full_text: string
}

/** 音色训练结果（GET /voiceTrain/results、/results/public、/results/all 返回的元素） */
export interface VoiceTrainResult {
  /** 训练任务 id（同时作为列表去重/编辑的唯一标识） */
  taskId: string
  /** 任务名（可为空串） */
  taskName: string
  /** 音色资源名（列表展示用，可为空串） */
  resourceName: string
  /** 训练音色 vid */
  trainVid: string
  /** 训练音色 vcn */
  trainVcn: string
  /** 音色资源 assetId */
  assetId: string
  /** 训练 id */
  trainId: string
  /** 应用 id */
  appId: string
  /** 失败描述（JSON 字符串） */
  failedDesc: string
  /** 性别 */
  sex: number
  /** 训练状态：0 训练中 / 1 成功 / 2 失败 */
  trainStatus: number
  /** 年龄段 */
  ageGroup: number
  textSegId: string
  textId: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
  /** 更新时间（ISO 字符串） */
  updatedAt: string
}
