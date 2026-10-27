import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { createConversation } from '@/api/ai-chat'
import {
  aiPlatformQueryKeys,
  getAiPlatformList,
  getAiPlatformProviders,
} from '@/api/ai-platforms'
import { useChatStream } from '@/hooks/use-chat-stream'
import type { AiPlatform, AiPlatformPresetModel } from '@/types/ai-platform'

/** 平台下拉一次拉取的最大条数（用户平台数量有限，无需分页交互） */
const PLATFORM_FETCH_LIMIT = 100

/** LLM 生成状态 */
export type LlmGenerationStatus = 'idle' | 'generating' | 'success' | 'failed'

/** 生成表单字段（不含结果），供共享表单组件消费 */
export interface LlmGenerationFormController {
  /** 可选 AI 平台列表 */
  platforms: AiPlatform[]
  /** 平台列表是否加载中 */
  isPlatformsLoading: boolean
  /** 选中的平台配置 id（= AiPlatform._id） */
  accountId: string
  /** 切换平台（会重置模型为该平台默认模型） */
  setAccountId: (value: string) => void
  /** 所选平台可用的预设模型 */
  modelOptions: AiPlatformPresetModel[]
  /** 选中的模型 id */
  modelName: string
  setModelName: (value: string) => void
  /** 自定义提示词（留空则使用内置默认指令） */
  prompt: string
  setPrompt: (value: string) => void
  /** 生成状态 */
  status: LlmGenerationStatus
  /** 是否正在生成（流式中） */
  isGenerating: boolean
  /** 流式累积的原始文本（生成中实时预览） */
  streamingText: string
  /** 失败原因 / 解析失败提示 */
  error: string
  /** 是否可提交生成 */
  canGenerate: boolean
  /** 开始生成（先建/复用会话，再流式对话） */
  generate: () => void
  /** 停止生成 */
  stop: () => void
}

/** 通用 LLM 生成控制器：表单字段 + 结构化结果 */
export interface LlmGenerationController<T> extends LlmGenerationFormController {
  /** 解析出的结构化结果，失败或未生成时为 null */
  result: T | null
  /** 模型原始返回文本（解析失败时回退展示） */
  rawText: string
}

/** useLlmGeneration 入参 */
export interface UseLlmGenerationOptions<T> {
  /** 是否已进入本步骤（未进入时不请求平台/模型列表） */
  enabled?: boolean
  /** 数据是否就绪（为空则不可生成） */
  dataReady: boolean
  /** 由用户提示词构建最终 prompt */
  buildPrompt: (userPrompt: string) => string
  /** 解析 LLM 原始返回为结构化结果（失败返回 null） */
  parse: (raw: string) => T | null
}

/** 已创建的会话快照：同一平台复用，平台变更时重建 */
interface ActiveConversation {
  accountId: string
  id: string
}

const EMPTY_PLATFORMS: AiPlatform[] = []
const EMPTY_MODELS: AiPlatformPresetModel[] = []

/**
 * 通用 LLM 生成：让用户选平台 + 模型 + 提示词，复用 /aiChat 流式对话接口调用大模型，
 * 把返回文本解析为结构化结果。会话按平台复用（平台变更重建），模型按请求级覆盖。
 *
 * 场景处理中「视频理解」「解说生成」等步骤共用本 hook，差异仅在 buildPrompt / parse。
 */
export function useLlmGeneration<T>({
  enabled = true,
  dataReady,
  buildPrompt,
  parse,
}: UseLlmGenerationOptions<T>): LlmGenerationController<T> {
  const [accountId, setAccountIdState] = useState('')
  const [modelName, setModelName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<LlmGenerationStatus>('idle')
  const [result, setResult] = useState<T | null>(null)
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState('')

  const conversationRef = useRef<ActiveConversation | null>(null)
  const { isStreaming, streamingText, startStream, stopStream } = useChatStream()

  // 平台列表：作为下拉选项（与「新建会话」同 key 前缀，避免与分页列表冲突）
  const platformsQuery = useQuery({
    queryKey: [...aiPlatformQueryKeys.list, 'llm-generation'],
    queryFn: () => getAiPlatformList({ page: 1, limit: PLATFORM_FETCH_LIMIT }),
    enabled,
    staleTime: 5 * 60_000,
  })

  // 平台预设模型：按选中平台的 provider 取
  const providersQuery = useQuery({
    queryKey: aiPlatformQueryKeys.providers,
    queryFn: getAiPlatformProviders,
    enabled,
    staleTime: 5 * 60_000,
  })

  const platforms = platformsQuery.data?.list ?? EMPTY_PLATFORMS
  const selectedPlatform = platforms.find((item) => item._id === accountId) ?? null

  const modelOptions = useMemo<AiPlatformPresetModel[]>(() => {
    if (!selectedPlatform) return EMPTY_MODELS
    return (
      providersQuery.data?.list.find(
        (item) => item.key === selectedPlatform.provider,
      )?.presetModels ?? EMPTY_MODELS
    )
  }, [selectedPlatform, providersQuery.data])

  // 切换平台时重置模型为该平台默认模型
  const setAccountId = useCallback(
    (value: string) => {
      setAccountIdState(value)
      const platform = platforms.find((item) => item._id === value)
      setModelName(platform?.defaultModel ?? '')
    },
    [platforms],
  )

  const canGenerate = accountId !== '' && dataReady && !isStreaming

  const generate = useCallback(async () => {
    if (!accountId || !dataReady || isStreaming) return

    setStatus('generating')
    setError('')
    setResult(null)
    setRawText('')

    // 会话：同一平台复用，平台变更时重建
    let conversationId =
      conversationRef.current?.accountId === accountId
        ? conversationRef.current.id
        : ''
    if (!conversationId) {
      try {
        const conversation = await createConversation({ accountId })
        conversationId = conversation._id
        conversationRef.current = { accountId, id: conversationId }
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : '创建会话失败')
        return
      }
    }

    await startStream(
      conversationId,
      buildPrompt(prompt),
      {
        onDone: ({ content }) => {
          setRawText(content)
          const parsed = parse(content)
          setResult(parsed)
          setStatus('success')
          if (!parsed) setError('模型返回内容无法解析为结构化结果，已展示原始文本。')
        },
        onError: (message, content) => {
          setRawText(content)
          setStatus('failed')
          setError(message)
        },
        onStop: (content) => {
          setRawText(content)
          const parsed = parse(content)
          setResult(parsed)
          if (parsed) {
            setStatus('success')
          } else {
            setStatus('failed')
            setError('已停止生成。')
          }
        },
      },
      { modelName },
    )
  }, [accountId, dataReady, isStreaming, prompt, buildPrompt, parse, modelName, startStream])

  return {
    platforms,
    isPlatformsLoading: platformsQuery.isLoading,
    accountId,
    setAccountId,
    modelOptions,
    modelName,
    setModelName,
    prompt,
    setPrompt,
    status,
    isGenerating: isStreaming,
    streamingText,
    error,
    result,
    rawText,
    canGenerate,
    generate,
    stop: stopStream,
  }
}
