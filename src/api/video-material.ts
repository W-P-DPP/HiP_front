import type { PageResult } from '@/types/api'
import type { ChunkSession, VideoMaterial, VideoMaterialGroup } from '@/types/video-material'
import { del, get, post, put } from '@/utils/axios'
import type { RequestConfig } from '@/utils/axios'

/** 分片上传单次请求超时：单分片可达 16MB，放宽到 2 分钟（默认 15s 不足以传完） */
const CHUNK_UPLOAD_TIMEOUT = 120_000

export const videoMaterialQueryKeys = {
  my: ['video-material', 'my'] as const,
  public: ['video-material', 'public'] as const,
}

export const videoMaterialGroupQueryKeys = {
  list: ['video-material-group', 'list'] as const,
}

/** 分组列表（GET /videoMaterialGroups） */
export const getVideoMaterialGroups = () =>
  get<{ list: VideoMaterialGroup[] }>('/videoMaterialGroups')

/** 新增分组（POST /videoMaterialGroups） */
export const createVideoMaterialGroup = (name: string) =>
  post<VideoMaterialGroup>('/videoMaterialGroups', { name })

/** 重命名分组（PUT /videoMaterialGroups/:id，参数放 body） */
export const renameVideoMaterialGroup = (id: string, name: string) =>
  put<VideoMaterialGroup | null>(`/videoMaterialGroups/${id}`, { name })

/** 删除分组（DELETE /videoMaterialGroups/:id） */
export const deleteVideoMaterialGroup = (id: string) =>
  del<null>(`/videoMaterialGroups/${id}`)

/** 素材分页查询参数 */
export interface GetVideoMaterialsParams {
  page: number
  /** 后端分页参数名是 limit，不是 pageSize */
  limit: number
  /** 关键词（模糊匹配，可选） */
  keyword?: string
  /** 文件名（模糊匹配，可选，与 keyword 为 AND 组合） */
  fileName?: string
  /** 分组 id（可选，不传=全部） */
  groupId?: string
}

/** 分页查询我的素材（cookie 鉴权） */
export const getMyVideoMaterials = (params: GetVideoMaterialsParams) =>
  get<PageResult<VideoMaterial>>('/videoMaterials/my', { params })

/** 分页查询公共素材 */
export const getPublicVideoMaterials = (params: GetVideoMaterialsParams) =>
  get<PageResult<VideoMaterial>>('/videoMaterials/public', { params })

/** 上传素材参数：file 整份直传，uploadId 分片合并，二选一 */
export type CreateVideoMaterialParams =
  | { file: File; keyword: string; fileName: string; groupId?: string }
  | { uploadId: string; keyword: string; fileName?: string; groupId?: string }

/**
 * 上传/合并素材（POST /videoMaterials）。
 * 分片口径传 JSON { uploadId, keyword, fileName?, groupId? }，整份口径传 FormData。
 */
export const createVideoMaterial = (params: CreateVideoMaterialParams) => {
  if ('uploadId' in params) {
    return post<VideoMaterial | null>(
      '/videoMaterials',
      {
        uploadId: params.uploadId,
        keyword: params.keyword,
        ...(params.fileName ? { fileName: params.fileName } : {}),
        ...(params.groupId ? { groupId: params.groupId } : {}),
      },
      { successMessage: '素材上传成功' },
    )
  }
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('keyword', params.keyword)
  formData.append('fileName', params.fileName)
  if (params.groupId) formData.append('groupId', params.groupId)
  return post<VideoMaterial | null>('/videoMaterials', formData, {
    successMessage: '素材上传成功',
  })
}

/** 创建分片上传会话参数 */
export interface InitChunkUploadParams {
  fileName: string
  fileSize: number
  totalChunks: number
  /** 与 fileSize/totalChunks 同一口径，服务端强校验 */
  chunkSize: number
}

/** 创建分片上传会话（POST /videoMaterials/chunks/init）；错误由调用方统一提示，故静默 */
export const initVideoMaterialChunkUpload = (params: InitChunkUploadParams) =>
  post<ChunkSession>('/videoMaterials/chunks/init', params, { silent: true })

/** 上传单个分片的返回：本次下标 + 最新会话快照 */
export interface UploadChunkResult {
  index: number
  session: ChunkSession
}

/** 上传单个分片（POST /videoMaterials/chunks/:uploadId/:index，文件字段固定 chunk）；错误静默由调用方提示 */
export const uploadVideoMaterialChunk = (
  uploadId: string,
  index: number,
  chunk: Blob,
  config?: RequestConfig,
) => {
  const formData = new FormData()
  formData.append('chunk', chunk)
  return post<UploadChunkResult>(
    `/videoMaterials/chunks/${uploadId}/${index}`,
    formData,
    { silent: true, timeout: CHUNK_UPLOAD_TIMEOUT, ...config },
  )
}

/** 放弃分片上传（DELETE /videoMaterials/chunks/:uploadId）；清理尽力而为，静默 */
export const cancelVideoMaterialChunkUpload = (uploadId: string) =>
  del<null>(`/videoMaterials/chunks/${uploadId}`, { silent: true })

/** 更新素材参数 */
export interface UpdateVideoMaterialParams {
  id: string
  keyword: string
  /** 所属分组 id；空串表示移出分组，不传则不改动分组 */
  groupId?: string
}

/** 更新素材关键词与分组（PUT /videoMaterials/:id，参数放 body） */
export const updateVideoMaterial = ({ id, keyword, groupId }: UpdateVideoMaterialParams) =>
  put<VideoMaterial | null>(`/videoMaterials/${id}`, {
    keyword,
    ...(groupId !== undefined ? { groupId } : {}),
  })

/** 删除素材（DELETE /videoMaterials/:id） */
export const deleteVideoMaterial = (id: string) =>
  del<null>(`/videoMaterials/${id}`)

/** 批量归入分组参数 */
export interface BatchGroupVideoMaterialsParams {
  /** 素材 id 列表 */
  ids: string[]
  /** 目标分组 id；空串表示移出分组（后端约定） */
  groupId: string
}

/** 批量归入分组（PUT /videoMaterials/batchGroup，成功提示由后端 msg 统一弹出） */
export const batchGroupVideoMaterials = ({ ids, groupId }: BatchGroupVideoMaterialsParams) =>
  put<{ modifiedCount: number }>('/videoMaterials/batchGroup', { ids, groupId })
