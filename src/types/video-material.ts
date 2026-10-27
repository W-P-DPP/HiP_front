import type { PageResult } from '@/types/api'

/** 素材文件记录（GET 列表时内嵌在素材项中） */
export interface VideoMaterialFile {
  _id: string
  originalName: string
  storedName: string
  path: string
  size: number
  mimeType: string
  ext: string
  md5: string
  category: string
  downloadCount: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  /** 文件访问地址（缩略图 / MediaPreview 直接使用） */
  url: string
}

/** 素材库条目 */
export interface VideoMaterial {
  _id: string
  /** 上传时填写的关键词 */
  keyword: string
  fileId: string
  /** 上传时的原始文件名 */
  fileName: string
  hitCount: number
  createdAt: string
  updatedAt: string
  file: VideoMaterialFile
  /** 所属分组 id（未分组为 null/缺失） */
  groupId?: string | null
}

/** 素材分组 */
export interface VideoMaterialGroup {
  _id: string
  name: string
  createdAt: string
  updatedAt: string
}

/** 分页结果（axios 拦截器已解出 data；后端多余的 page/limit 字段由 PageResult 兼容忽略） */
export type VideoMaterialPageResult = PageResult<VideoMaterial>

/** 分片上传会话（init / 上传分片返回 / GET 进度同构） */
export interface ChunkSession {
  uploadId: string
  fileName: string
  fileSize: number
  mimeType: string
  totalChunks: number
  chunkSize: number
  createdAt: string
  /** 已接收的分片下标 */
  received: number[]
  /** 是否已收齐 */
  completed: boolean
}
