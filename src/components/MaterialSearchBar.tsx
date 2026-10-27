import { RotateCcw, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MaterialSearchBarProps {
  /** 触发搜索：回调已 trim 的关键词与文件名（空串表示不筛选该字段） */
  onSearch: (keyword: string, fileName: string) => void
  /** 触发重置：清空搜索条件 */
  onReset: () => void
}

/** 素材库共享搜索栏：关键词 + 文件名两个输入，回车/按钮触发搜索，重置清空 */
export function MaterialSearchBar({ onSearch, onReset }: MaterialSearchBarProps) {
  const [keywordInput, setKeywordInput] = useState('')
  const [fileNameInput, setFileNameInput] = useState('')

  const handleSearch = useCallback(() => {
    onSearch(keywordInput.trim(), fileNameInput.trim())
  }, [keywordInput, fileNameInput, onSearch])

  const handleReset = useCallback(() => {
    setKeywordInput('')
    setFileNameInput('')
    onReset()
  }, [onReset])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') handleSearch()
    },
    [handleSearch],
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        aria-label="搜索关键词"
        placeholder="搜索关键词"
        value={keywordInput}
        onChange={(event) => setKeywordInput(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-48"
      />
      <Input
        aria-label="搜索文件名"
        placeholder="搜索文件名"
        value={fileNameInput}
        onChange={(event) => setFileNameInput(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-48"
      />
      <Button data-icon="inline-start" onClick={handleSearch}>
        <Search />
        搜索
      </Button>
      <Button variant="ghost" data-icon="inline-start" onClick={handleReset}>
        <RotateCcw />
        重置
      </Button>
    </div>
  )
}
