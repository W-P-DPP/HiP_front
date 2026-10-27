import { useCallback, useEffect, useRef, useState } from 'react'

import { streamConversationChat } from '@/api/ai-chat'
import type { AiChatStreamFrame } from '@/types/ai-chat'

/** 打字机刷新间隔（毫秒，约一帧） */
const TYPEWRITER_INTERVAL = 16
/** 每帧推进比例：剩余字符数 / 该值（至少 1 个），避免长回答尾部拖太久 */
const TYPEWRITER_SPEED_DIVISOR = 12

export interface ChatStreamHandlers {
  /** 正常结束（收到 done 帧，或流正常关闭的兜底收尾）；messageId 为空表示未收到 done 帧 */
  onDone: (payload: { messageId: string; content: string }) => void
  /** 出错终止；content 为已生成的部分内容（可能为空串） */
  onError: (errorMessage: string, content: string) => void
  /** 用户主动停止生成；content 为停止时已生成的内容 */
  onStop: (content: string) => void
}

/** 一轮流式对话的终态 */
type StreamOutcome =
  | { status: 'done'; messageId: string; content: string }
  | { status: 'error'; message: string; content: string }
  | { status: 'stopped'; content: string }

/** startStream 的可选参数 */
export interface StartStreamOptions {
  /** 本轮模型覆盖；不传则用会话默认模型 */
  modelName?: string
}

export interface UseChatStreamResult {
  /** 流式进行中（含打字机尚未刷完缓冲的阶段） */
  isStreaming: boolean
  /** 打字机已刷出的文本，供流式中的助手气泡展示 */
  streamingText: string
  startStream: (
    conversationId: string,
    content: string,
    handlers: ChatStreamHandlers,
    options?: StartStreamOptions,
  ) => Promise<void>
  /** 停止生成（中断当前流） */
  stopStream: () => void
}

/**
 * 流式对话 + 打字机效果。
 * 先把收到的 delta 累加进 ref（原始缓冲），再由固定间隔的循环逐字刷进 state，
 * 避免后端大块吐字时整段跳出；done 帧的 content 是权威全文，用于收尾对齐。
 * 终态统一交给调用方接管渲染（本 hook 只暴露流式过程中的即时文本）。
 */
export function useChatStream(): UseChatStreamResult {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')

  /** 原始缓冲：已收到但可能尚未展示的完整文本 */
  const rawRef = useRef('')
  /** 已展示的字符数 */
  const shownRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const handlersRef = useRef<ChatStreamHandlers | null>(null)
  const outcomeRef = useRef<StreamOutcome | null>(null)
  /** 流式轮次：切换会话重开时，用于丢弃上一轮迟到的收尾 */
  const runIdRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 终态只回调一次：清表、清空流式文本，把结果交给调用方接管渲染
  const settle = useCallback(() => {
    const outcome = outcomeRef.current
    if (!outcome) return
    outcomeRef.current = null
    clearTimer()
    setStreamingText('')
    setIsStreaming(false)

    if (outcome.status === 'done') {
      handlersRef.current?.onDone({
        messageId: outcome.messageId,
        content: outcome.content,
      })
      return
    }
    if (outcome.status === 'error') {
      handlersRef.current?.onError(outcome.message, outcome.content)
      return
    }
    handlersRef.current?.onStop(outcome.content)
  }, [clearTimer])

  // 定时把原始缓冲逐字刷到 streamingText，并在上游结束后收尾
  const startTimer = useCallback(() => {
    clearTimer()
    timerRef.current = window.setInterval(() => {
      const raw = rawRef.current
      if (shownRef.current < raw.length) {
        const step = Math.max(
          1,
          Math.ceil((raw.length - shownRef.current) / TYPEWRITER_SPEED_DIVISOR),
        )
        shownRef.current = Math.min(raw.length, shownRef.current + step)
        setStreamingText(raw.slice(0, shownRef.current))
      }

      const outcome = outcomeRef.current
      if (!outcome) return
      // done 要等缓冲刷完再收尾，避免末段文字被跳过；错误/停止立即收尾
      if (outcome.status === 'done' && shownRef.current < raw.length) return
      settle()
    }, TYPEWRITER_INTERVAL)
  }, [clearTimer, settle])

  const stopStream = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const startStream = useCallback(
    async (
      conversationId: string,
      content: string,
      handlers: ChatStreamHandlers,
      options?: StartStreamOptions,
    ) => {
      // 发送按钮在流式中已禁用，这里兜底中断上一轮，避免两个流交叉写同一缓冲
      controllerRef.current?.abort()

      runIdRef.current += 1
      const runId = runIdRef.current
      rawRef.current = ''
      shownRef.current = 0
      outcomeRef.current = null
      handlersRef.current = handlers
      setStreamingText('')
      setIsStreaming(true)

      const controller = new AbortController()
      controllerRef.current = controller
      startTimer()

      const handleFrame = (frame: AiChatStreamFrame) => {
        if (runId !== runIdRef.current) return
        if (frame.type === 'delta') {
          rawRef.current += frame.content
          return
        }
        if (frame.type === 'done') {
          // done 的 content 是权威全文：覆盖 delta 累加值，避免中途丢帧导致内容不全
          rawRef.current = frame.content
          outcomeRef.current = {
            status: 'done',
            messageId: frame.messageId,
            content: frame.content,
          }
          return
        }
        // error 帧是终止帧，已输出的部分内容也要展示
        if (frame.type === 'error') {
          outcomeRef.current = {
            status: 'error',
            message: frame.message,
            content: rawRef.current,
          }
        }
      }

      try {
        await streamConversationChat(conversationId, content, {
          signal: controller.signal,
          onFrame: handleFrame,
          modelName: options?.modelName,
        })
        if (runId !== runIdRef.current) return
        // 兜底：流正常关闭但未收到 done 帧时，也要让打字机收尾
        if (!outcomeRef.current) {
          outcomeRef.current = {
            status: 'done',
            messageId: '',
            content: rawRef.current,
          }
        }
      } catch (error) {
        if (runId !== runIdRef.current) return
        if (controller.signal.aborted) {
          outcomeRef.current = { status: 'stopped', content: rawRef.current }
          return
        }
        outcomeRef.current = {
          status: 'error',
          message: error instanceof Error ? error.message : '对话请求失败',
          content: rawRef.current,
        }
      }
    },
    [startTimer],
  )

  // 卸载时中断流并清表，避免离开页面后仍写状态
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    },
    [],
  )

  return { isStreaming, streamingText, startStream, stopStream }
}
