import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { createConversation } from '@/api/ai-chat'
import { aiPlatformQueryKeys, getAiPlatformList } from '@/api/ai-platforms'
import { AppDialog } from '@/components/AppDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AiConversation } from '@/types/ai-chat'
import type { AiPlatform } from '@/types/ai-platform'

/** 平台下拉的等待提示 */
const PLATFORM_PLACEHOLDER = '请选择 AI 平台'
/** 平台下拉一次拉取的最大条数（用户平台数量有限，无需分页交互） */
const PLATFORM_FETCH_LIMIT = 100

export interface CreateConversationDialogProps {
  /** 受控开关 */
  open: boolean
  /** 开关回调 */
  onOpenChange: (open: boolean) => void
  /** 创建成功回调，携带新建的会话（页面据此进入该会话） */
  onSuccess?: (conversation: AiConversation) => void
}

/**
 * 新建会话弹框：选中 AI 平台后确认按钮才可用，入参为平台的配置 id。
 * 平台选项复用 GET /aiPlatforms 列表；查询键在既有 list 前缀下加区分段，
 * 避免与分页列表（键为 [...list, { page, pageSize }]）冲突。
 */
export function CreateConversationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateConversationDialogProps) {
  // 每次打开由父级变更 key 重新挂载本组件，选择状态自然重置
  const [accountId, setAccountId] = useState('')

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [...aiPlatformQueryKeys.list, 'conversation-picker'],
    queryFn: () => getAiPlatformList({ page: 1, limit: PLATFORM_FETCH_LIMIT }),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const platforms: AiPlatform[] = data?.list ?? []
  const createMutation = useMutation({ mutationFn: createConversation })

  const handleSubmit = useCallback(async () => {
    if (!accountId) return
    try {
      const conversation = await createMutation.mutateAsync({ accountId })
      onOpenChange(false)
      onSuccess?.(conversation)
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [accountId, createMutation, onOpenChange, onSuccess])

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建会话"
      description="选择一个 AI 平台后开启新对话。"
      confirmText="创建"
      confirmLoading={createMutation.isPending}
      confirmDisabled={!accountId}
      onConfirm={handleSubmit}
    >
      <div className="flex flex-col gap-3 px-2.5 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conversation-platform">AI 平台</Label>
          <Select
            value={accountId || null}
            onValueChange={(value) =>
              setAccountId(typeof value === 'string' ? value : '')
            }
            disabled={isLoading || platforms.length === 0}
          >
            <SelectTrigger id="conversation-platform" className="w-full">
              <SelectValue>
                {(value) => {
                  const key = typeof value === 'string' ? value : ''
                  if (!key) {
                    return (
                      <span className="text-muted-foreground">
                        {PLATFORM_PLACEHOLDER}
                      </span>
                    )
                  }
                  return platforms.find((item) => item._id === key)?.name ?? key
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {platforms.map((platform) => (
                <SelectItem key={platform._id} value={platform._id}>
                  {platform.name}
                  <span className="font-mono text-xs text-muted-foreground">
                    {platform.defaultModel}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 无可用平台时给出明确去向，同时保持创建按钮禁用 */}
        {!isLoading && platforms.length === 0 ? (
          <Alert>
            <AlertTitle>暂无可用 AI 平台</AlertTitle>
            <AlertDescription>
              {isError
                ? '平台列表加载失败，请关闭弹框后重试。'
                : '请先到「个人资料 → AI 平台配置」添加平台，再创建会话。'}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </AppDialog>
  )
}
