import type { PageResult } from '@/types/api'
import type { VoiceTrainResult, VoiceTrainText } from '@/types/voice-training'
import { get, post, put } from '@/utils/axios'

export const voiceTrainingQueryKeys = {
  results: ['voice-training', 'results'] as const,
  texts: ['voice-training', 'texts'] as const,
}

/** 音色训练结果分页查询参数（后端分页参数名是 limit，不是 pageSize） */
export interface GetVoiceTrainResultsParams {
  page: number
  limit: number
}

/** 查询音色训练结果（admin 视角：管理范围内的结果） */
export const getVoiceTrainResults = (params: GetVoiceTrainResultsParams) =>
  get<PageResult<VoiceTrainResult>>('/voiceTrain/results', { params })

/** 查询公共音色训练结果（user / admin 均可见） */
export const getPublicVoiceTrainResults = (params: GetVoiceTrainResultsParams) =>
  get<PageResult<VoiceTrainResult>>('/voiceTrain/results/public', { params })

/** 查询全部音色训练结果（sadmin） */
export const getAllVoiceTrainResults = (params: GetVoiceTrainResultsParams) =>
  get<PageResult<VoiceTrainResult>>('/voiceTrain/results/all', { params })

/** 单次翻页条数上限（拉取全量时使用） */
const RESULT_FETCH_PAGE_SIZE = 100

/** 按 total 循环拉取某查询的全量结果（前端合并/去重/分页需要全量数据） */
export async function fetchAllVoiceTrainResults(
  fetchPage: (params: GetVoiceTrainResultsParams) => Promise<PageResult<VoiceTrainResult>>,
): Promise<VoiceTrainResult[]> {
  const first = await fetchPage({ page: 1, limit: RESULT_FETCH_PAGE_SIZE })
  if (first.total <= first.list.length) return first.list
  const pages = Math.ceil(first.total / RESULT_FETCH_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      fetchPage({ page: index + 2, limit: RESULT_FETCH_PAGE_SIZE }),
    ),
  )
  return [...first.list, ...rest.flatMap((page) => page.list)]
}

/**
 * 编辑音色训练结果名称（PUT /voiceTrain/result，仅允许修改 resourceName）。
 * 注意：写接口的标识字段名按 taskId 约定；若后端实收 trainId/id 需在此调整。
 */
export const updateVoiceTrainResult = ({
  taskId,
  resourceName,
}: {
  taskId: string
  resourceName: string
}): Promise<VoiceTrainResult | null> =>
  put<VoiceTrainResult | null>('/voiceTrain/result', { taskId, resourceName })

/** 获取训练样本文本（进入新增音色页时调用，后端固定返回通用训练文本） */
export const getVoiceTrainTexts = (): Promise<VoiceTrainText> =>
  post<VoiceTrainText>('/voiceTrain/texts')

/** 音色训练任务提交参数（POST /voiceTrain/task/submit，multipart/form-data） */
export interface SubmitVoiceTrainTaskParams {
  /** 朗读音频文件 */
  file: File
  /** 当前登录用户 id */
  userId: string
  /** 训练样本文本段 id（VoiceTrainTextSeg.segId） */
  textSegId: number
  /** 训练样本文本库 id（VoiceTrainText.textId） */
  textId: number
  /** 音色名称 */
  resourceName: string
  /** 性别：1 男 / 2 女 */
  sex: number
}

/** 提交音色训练任务并上传音频（返回任务 id，随后轮询训练结果） */
export const submitVoiceTrainTask = (
  params: SubmitVoiceTrainTaskParams,
): Promise<{ taskId: string }> => {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('userId', params.userId)
  formData.append('textSegId', String(params.textSegId))
  formData.append('textId', String(params.textId))
  formData.append('resourceName', params.resourceName)
  formData.append('sex', String(params.sex))
  return post<{ taskId: string }>('/voiceTrain/task/submit', formData, { timeout: 6000 })
}

/** 查询音色训练任务结果（轮询用：silent 跳过全局成功/失败 toast；任务未就绪时 data 为空） */
export const getVoiceTrainResult = (
  taskId: string,
): Promise<VoiceTrainResult | null> =>
  post<VoiceTrainResult | null>(
    '/voiceTrain/result',
    { taskId },
    { silent: true },
  )
