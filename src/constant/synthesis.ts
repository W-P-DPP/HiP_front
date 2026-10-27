/** 文案最大字符数，达到上限即不可进入下一步 */
export const MAX_SCRIPT_LENGTH = 5000

/** 音色合成速度档位（后端三档；UI 选项集用 ToggleGroup，顺序即展示顺序） */
export const VOICE_SPEED_MODES = [
  { value: 'fast', label: '极速' },
  { value: 'balanced', label: '均衡' },
  { value: 'quality', label: '高质量' },
] as const

/** 音频合成步骤拉取当前用户音色列表的分页参数：一次取全量，无需翻页 */
export const VOICE_LIST_PAGE_SIZE = 9999
