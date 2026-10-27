import { useCallback, useRef, useState } from 'react'

import {
  cancelVideoMaterialChunkUpload,
  createVideoMaterial,
  initVideoMaterialChunkUpload,
  uploadVideoMaterialChunk,
} from '@/api/video-material'
import { ApiError } from '@/utils/axios'
import { CHUNK_SIZE, CHUNK_UPLOAD_THRESHOLD } from '@/utils/material'
import { message } from '@/utils/message'

/** 分片并发数 */
const CHUNK_UPLOAD_CONCURRENCY = 3

/** 以固定并发数依次消费 items，任一 worker 抛错即整体 reject */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
}

/** 上传素材参数 */
export interface UploadMaterialParams {
  file: File
  keyword: string
  fileName: string
  /** 所属分组 id（可选，不传=不分组） */
  groupId?: string
}

export interface UseMaterialUploadResult {
  /** 触发上传：>16MB 自动分片，否则整份直传 */
  upload: (params: UploadMaterialParams) => Promise<void>
  /** 上传进度 0..1 */
  progress: number
  /** 是否正在上传 */
  isUploading: boolean
  /** 本次是否为分片上传（决定是否展示进度条） */
  isChunked: boolean
  /** 取消上传：中止在途请求并清理分片会话 */
  cancel: () => void
}

/**
 * 素材上传：文件 > 16MB 时走「init 会话 → 并发上传分片 → 合并入库」，否则整份直传。
 * 分片流程的 init/分片请求静默（便于取消时抑制误报），错误在本 hook 内统一提示；
 * 合并与整份直传仍由 axios 拦截器统一提示。
 */
export function useMaterialUpload(): UseMaterialUploadResult {
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isChunked, setIsChunked] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const uploadIdRef = useRef('')
  /** 各分片已上传字节（含在途 onUploadProgress） */
  const loadedRef = useRef(new Map<number, number>())
  const totalBytesRef = useRef(0)

  const reportProgress = useCallback(() => {
    const total = totalBytesRef.current
    if (!total) return
    let loaded = 0
    loadedRef.current.forEach((bytes) => {
      loaded += bytes
    })
    setProgress(Math.min(loaded / total, 1))
  }, [])

  /** 放弃未合并的分片会话（尽力而为、静默） */
  const cleanupSession = useCallback(async () => {
    const uploadId = uploadIdRef.current
    uploadIdRef.current = ''
    if (!uploadId) return
    try {
      await cancelVideoMaterialChunkUpload(uploadId)
    } catch {
      // 会话可能已被合并或过期，清理失败可忽略
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    void cleanupSession()
  }, [cleanupSession])

  const uploadChunked = useCallback(
    async (params: UploadMaterialParams, controller: AbortController) => {
      const { file, keyword, fileName, groupId } = params
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      let uploadId = ''
      try {
        const session = await initVideoMaterialChunkUpload({
          fileName,
          fileSize: file.size,
          totalChunks,
          chunkSize: CHUNK_SIZE,
        })
        uploadId = session.uploadId
        uploadIdRef.current = uploadId

        const indices = Array.from({ length: totalChunks }, (_, index) => index)
        await runWithConcurrency(indices, CHUNK_UPLOAD_CONCURRENCY, async (index) => {
          if (controller.signal.aborted) return
          const start = index * CHUNK_SIZE
          const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
          await uploadVideoMaterialChunk(uploadId, index, chunk, {
            signal: controller.signal,
            onUploadProgress: (event) => {
              loadedRef.current.set(index, event.loaded)
              reportProgress()
            },
          })
        })
      } catch (error) {
        // init/分片请求已静默，此处统一提示；主动取消不提示
        if (!controller.signal.aborted) {
          message.error(error instanceof ApiError ? error.message : '上传失败')
        }
        throw error
      }
      // 合并入库：非静默，成功/失败提示沿用拦截器
      await createVideoMaterial({
        uploadId,
        keyword,
        fileName,
        ...(groupId ? { groupId } : {}),
      })
      uploadIdRef.current = ''
    },
    [reportProgress],
  )

  const upload = useCallback(
    async (params: UploadMaterialParams) => {
      const { file } = params
      const chunked = file.size > CHUNK_UPLOAD_THRESHOLD
      const controller = new AbortController()
      abortRef.current = controller
      loadedRef.current = new Map()
      totalBytesRef.current = file.size
      setProgress(0)
      setIsChunked(chunked)
      setIsUploading(true)
      try {
        if (chunked) {
          await uploadChunked(params, controller)
        } else {
          await createVideoMaterial({
            file,
            keyword: params.keyword,
            fileName: params.fileName,
            ...(params.groupId ? { groupId: params.groupId } : {}),
          })
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        // 成功路径已清空 uploadId；失败/取消时清理残留会话
        await cleanupSession()
        setProgress(0)
        setIsChunked(false)
        setIsUploading(false)
      }
    },
    [cleanupSession, uploadChunked],
  )

  return { upload, progress, isUploading, isChunked, cancel }
}
