/**
 * SSE 流解析（项目首个流式响应解析器）。
 * 帧格式来自本项目对话接口约定：`data: ` + 单行 JSON + 空行分帧，
 * 无 event:/id:/retry: 字段，事件类型由 JSON 内的 type 字段区分。
 */

/** 帧分隔符（空行） */
const FRAME_SEPARATOR = '\n\n'
/** 数据行前缀 */
const DATA_PREFIX = 'data:'

/** 逐帧读取 SSE 流，每解析出一帧 data 内容回调一次 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      // stream: true 保证多字节字符（中文）被 chunk 截断时不会乱码
      buffer += decoder.decode(value, { stream: true })
      // 统一换行后再切帧，避免 \r\n\r\n 与 \n\n 混用时漏切
      buffer = drainFrames(buffer.replace(/\r\n/g, '\n'), onData)
    }
    // 流结束时可能残留最后一帧（结尾没有空行）
    const tail = extractSseData(buffer)
    if (tail) onData(tail)
  } finally {
    reader.releaseLock()
  }
}

/** 切出缓冲区中所有完整帧，返回剩余的不完整内容 */
function drainFrames(buffer: string, onData: (data: string) => void): string {
  let rest = buffer
  let separatorIndex = rest.indexOf(FRAME_SEPARATOR)

  while (separatorIndex !== -1) {
    const data = extractSseData(rest.slice(0, separatorIndex))
    if (data) onData(data)
    rest = rest.slice(separatorIndex + FRAME_SEPARATOR.length)
    separatorIndex = rest.indexOf(FRAME_SEPARATOR)
  }

  return rest
}

/** 取一帧内所有 data: 行并拼接（SSE 规范允许多行 data 组成同一事件） */
function extractSseData(frame: string): string {
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (!line.startsWith(DATA_PREFIX)) continue
    // 去掉 `data:` 与其后紧随的一个空格
    dataLines.push(line.slice(DATA_PREFIX.length).replace(/^ /, ''))
  }

  return dataLines.join('\n').trim()
}
