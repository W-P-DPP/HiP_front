import type { MediaPreviewType } from '@/components/MediaPreview'
import type { VideoMaterial } from '@/types/video-material'

/** 素材库文件类型工具：上传校验与展示类型判断共用 */

/** 图片扩展名集合 */
export const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'tiff',
  'tif',
])

/** 视频扩展名集合 */
export const VIDEO_EXTS = new Set([
  'mp4',
  'webm',
  'mov',
  'mkv',
  'avi',
  'm3u8',
  'flv',
  'ogv',
  'm4v',
  'wmv',
])

/** 音频扩展名集合（素材库展示类型判断 + 音视频上传校验） */
export const AUDIO_EXTS = new Set([
  'mp3',
  'wav',
  'ogg',
  'oga',
  'm4a',
  'aac',
  'flac',
  'wma',
  'opus',
])

/** 允许上传的素材 MIME 前缀：仅图片与视频 */
const SUPPORTED_MIME_PREFIXES = ['image/', 'video/']

/** 素材大小上限（与后端一致：2.5GB） */
export const MAX_MATERIAL_SIZE = 2.5 * 1024 * 1024 * 1024

/** 分片上传单分片大小（服务端上限 16MB，此处留余量取 10MB，避免顶到上限） */
export const CHUNK_SIZE = 10 * 1024 * 1024

/** 超过该大小才走分片上传，否则整份直传 */
export const CHUNK_UPLOAD_THRESHOLD = 16 * 1024 * 1024

/** 判断是否为允许上传的素材（仅图片/视频）；MIME 为空时按扩展名兜底 */
export function isSupportedMaterialFile(file: File): boolean {
  const mime = file.type.toLowerCase()
  if (SUPPORTED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)
}

/** 判断是否为图片文件（图像理解上传校验）；MIME 为空时按扩展名兜底 */
export function isSupportedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext)
}

/** 允许上传的媒体 MIME 前缀：音频与视频 */
const MEDIA_MIME_PREFIXES = ['audio/', 'video/']

/** 判断是否为允许上传的媒体文件（音/视频）；MIME 为空时按扩展名兜底 */
export function isSupportedMediaFile(file: File): boolean {
  const mime = file.type.toLowerCase()
  if (MEDIA_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext)
}

/** 按文件 mimeType（优先）/ 扩展名判断音视频类型（本地选择的文件预览用） */
export function resolveMediaFileType(file: File): MediaPreviewType {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_EXTS.has(ext) ? 'video' : 'audio'
}

/**
 * 按文件 mimeType（优先）/ 扩展名判断素材媒体类型。
 * URL 无扩展名，必须显式判断而非交给 MediaPreview 推断。
 */
export function resolveMaterialMediaType(item: VideoMaterial): MediaPreviewType {
  const mime = item.file?.mimeType ?? ''
  const ext = (item.file?.ext ?? '').replace(/^\./, '').toLowerCase()
  if (mime.startsWith('video/') || VIDEO_EXTS.has(ext)) return 'video'
  if (mime.startsWith('audio/') || AUDIO_EXTS.has(ext)) return 'audio'
  return 'image'
}
