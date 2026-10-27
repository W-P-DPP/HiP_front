import type { NumericFieldKey } from '@/constant/scene-process'
import type { VoiceTrainV2SpeedMode } from '@/types/voice-train-v2'

/**
 * 数字人工厂预填参数：从数字人合成记录跳转工作台时经 location.state 携带。
 * 除了文案/音色/形象等输入参数，还复用记录里已产出的音频与字幕子任务，
 * 使用户落到最后一步即可直接重新合成。
 */
export interface DigitalHumanFactorySeed {
  /** 记录主键：复用其成品任务，展示原成品视频或失败原因 */
  taskId: string
  /** 文案 */
  script: string
  /** 音色 id */
  voiceId: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 数字人形象 id */
  avatarId: string
  /** 音频合成子任务 id，空串表示音频未产出 */
  audioTaskId: string
  /** 产出音频的 file 记录 id，作为字幕子任务的源音频 */
  audioFileId: string
  /** 字幕合成子任务 id，空串表示字幕未产出 */
  subtitleTaskId: string
}

/** 短视频工厂预填参数：从短视频合成记录跳转工作台时经 location.state 携带 */
export interface VideoFactorySeed {
  /** 记录主键：复用其成品任务，展示原成品视频或失败原因 */
  taskId: string
  /** 文案 */
  script: string
  /** 音色 id */
  voiceId: string
  /** 速度档位 */
  speedMode: VoiceTrainV2SpeedMode
  /** 每段字幕对应的素材搜索词 */
  keywords: string[]
  /** 配音子任务 id，空串表示音频未产出 */
  voiceTaskId: string
  /** 合成音频的 file 记录 id */
  audioFileId: string
  /** 字幕子任务 id，空串表示字幕未产出 */
  subtitleTaskId: string
  /** SRT 字幕文件的 file 记录 id */
  srtFileId: string
}

/**
 * 下游异步任务预载项：从记录带入工作台时复用其已产出的抽帧 / 转写 / 图像识别任务。
 * sourceTaskId 为任务的来源任务 id（抽帧、转写为场景切分任务 id，图像识别为抽帧任务 id），
 * 工作台据此判定其来源是否与当前来源一致，来源已变更时不展示失效任务。
 */
export interface SceneProcessTaskSeed {
  /** 任务 id：工作台进入即拉取其详情（含 frames / sceneSegments / items） */
  taskId: string
  /** 来源任务 id（抽帧、转写为场景切分任务 id，图像识别为抽帧任务 id） */
  sourceTaskId: string
}

/**
 * 场景处理工作台预填参数：从场景切分记录跳转工作台时经 location.state 携带。
 * 预载已完成的切分任务与源视频，并复用其已产出的下游任务（抽帧 / 转写 / 图像识别），
 * 进入即可查看各步骤的执行数据，而非从零开始。
 */
export interface SceneProcessSeed {
  /** 已完成的场景切分任务 id：工作台进入即拉取其详情（含 scenes） */
  taskId: string
  /** 源视频 file 记录 id，用于构造选中的素材 */
  sourceFileId: string
  /** 源视频地址（后端 /api/files/:id/download），展示时交给 resolveMediaUrl 补前缀 */
  sourceUrl: string
  /** 源视频原始文件名 */
  originalName: string
  /** 实际使用的检测算法；default 表示走后端推荐值 */
  detector: string
  /** 实际使用的数字参数（字符串，0 收敛为 '' 表示走后端默认） */
  numericValues: Record<NumericFieldKey, string>
  /** 已产出的抽帧任务（取最近一次），缺省表示尚未抽帧 */
  frameTask?: SceneProcessTaskSeed
  /** 已产出的场景转写任务（取最近一次），缺省表示尚未转写 */
  transcribeTask?: SceneProcessTaskSeed
  /** 已产出的图像识别任务（取最近一次），缺省表示尚未识别 */
  imageTask?: SceneProcessTaskSeed
}
