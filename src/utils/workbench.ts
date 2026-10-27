import { VOICE_SPEED_MODES } from '@/constant/synthesis'
import type { DigitalHumanSynthesisRecord } from '@/types/digital-human'
import type { SceneSplitTask } from '@/types/scene-split'
import type { VideoMaterial } from '@/types/video-material'
import type { VideoPipelineV2Task } from '@/types/video-pipeline-v2'
import type { VoiceTrainV2SpeedMode } from '@/types/voice-train-v2'
import type {
  DigitalHumanFactorySeed,
  SceneProcessSeed,
  VideoFactorySeed,
} from '@/types/workbench'

/** 记录里的档位是宽松字符串，判断是否为合法档位 */
function isSpeedMode(value: string): value is VoiceTrainV2SpeedMode {
  return VOICE_SPEED_MODES.some((mode) => mode.value === value)
}

/** 记录档位非法（空串等）时回退均衡档，避免复用的音频被判定为已过期 */
function resolveSpeedMode(value: string): VoiceTrainV2SpeedMode {
  return isSpeedMode(value) ? value : 'balanced'
}

/** 数字人合成记录 → 数字人工厂预填参数 */
export function buildDigitalHumanFactorySeed(
  record: DigitalHumanSynthesisRecord,
): DigitalHumanFactorySeed {
  return {
    taskId: record.id,
    script: record.text,
    voiceId: record.voiceId,
    speedMode: resolveSpeedMode(record.speedMode),
    avatarId: record.avatarId,
    audioTaskId: record.audioTaskId,
    audioFileId: record.audioFileId,
    subtitleTaskId: record.subtitleTaskId,
  }
}

/** 短视频合成记录 → 短视频工厂预填参数 */
export function buildVideoFactorySeed(record: VideoPipelineV2Task): VideoFactorySeed {
  return {
    taskId: record.id,
    script: record.text,
    voiceId: record.voiceId,
    speedMode: resolveSpeedMode(record.speedMode),
    keywords: record.keywords ?? [],
    voiceTaskId: record.voiceTaskId,
    audioFileId: record.audioFileId,
    subtitleTaskId: record.subtitleTaskId,
    srtFileId: record.srtFileId,
  }
}

/** 记录的数值字段 0 视为未显式设置（走后端推荐值），收敛为空串 */
function toNumericValue(value: number): string {
  return value > 0 ? String(value) : ''
}

/** 取数组中创建时间最晚的一项（createdAt 为 ISO 字符串，可直接比较），空数组返回 undefined */
function pickLatestTask<T extends { createdAt: string }>(tasks: T[]): T | undefined {
  return tasks.reduce<T | undefined>(
    (latest, task) => (!latest || task.createdAt >= latest.createdAt ? task : latest),
    undefined,
  )
}

/** 场景切分记录 → 场景处理工作台预填参数 */
export function buildSceneProcessSeed(record: SceneSplitTask): SceneProcessSeed {
  // 复用记录里已产出的下游任务：各取最近一次，进入工作台即可查看其执行数据
  const frameTask = pickLatestTask(record.frameTasks)
  const transcribeTask = pickLatestTask(record.asrTasks)
  const imageTask = pickLatestTask(record.imageTasks)

  return {
    taskId: record.id,
    sourceFileId: record.sourceFileId,
    sourceUrl: record.sourceUrl,
    originalName: record.originalName,
    detector: record.detector || 'default',
    numericValues: {
      threshold: toNumericValue(record.threshold),
      minSceneLenSec: toNumericValue(record.minSceneLenSec),
      downscale: toNumericValue(record.downscale),
      frameSkip: toNumericValue(record.frameSkip),
      blackDetectSec: toNumericValue(record.blackDetectSec),
    },
    ...(frameTask
      ? { frameTask: { taskId: frameTask.id, sourceTaskId: frameTask.sourceTaskId } }
      : {}),
    ...(transcribeTask
      ? { transcribeTask: { taskId: transcribeTask.id, sourceTaskId: transcribeTask.sourceTaskId } }
      : {}),
    ...(imageTask
      ? { imageTask: { taskId: imageTask.id, sourceTaskId: imageTask.sourceTaskId } }
      : {}),
  }
}

/** 由记录构造工作台的占位素材：仅用于展示源视频与提交 fileId，无对应真实素材记录 */
export function buildSceneProcessMaterial(seed: SceneProcessSeed): VideoMaterial {
  return {
    _id: seed.sourceFileId,
    keyword: '',
    fileId: seed.sourceFileId,
    fileName: seed.originalName,
    hitCount: 0,
    createdAt: '',
    updatedAt: '',
    file: {
      _id: seed.sourceFileId,
      originalName: seed.originalName,
      storedName: '',
      path: '',
      size: 0,
      mimeType: '',
      ext: '',
      md5: '',
      category: '',
      downloadCount: 0,
      metadata: null,
      createdAt: '',
      updatedAt: '',
      url: seed.sourceUrl,
    },
  }
}
