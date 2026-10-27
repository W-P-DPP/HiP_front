import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import {
  aiPlatformQueryKeys,
  createAiPlatform,
  getAiPlatformProviders,
  updateAiPlatform,
} from '@/api/ai-platforms'
import type { AiPlatformParams } from '@/api/ai-platforms'
import { AppDialog } from '@/components/AppDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AiPlatform, AiPlatformProvider } from '@/types/ai-platform'

/** 平台下拉的等待提示（未选中平台时展示） */
const PROVIDER_PLACEHOLDER = '请选择平台'
/** 模型下拉的等待提示（未选平台前不可选，提示先选平台） */
const MODEL_PLACEHOLDER = '请先选择平台'

export interface AiPlatformDialogProps {
  /** 受控开关 */
  open: boolean
  /** 开关回调 */
  onOpenChange: (open: boolean) => void
  /** 传入 = 编辑（预填该条配置）；不传 = 新增 */
  platform?: AiPlatform | null
  /** 提交成功回调（页面里传 refetch） */
  onSuccess?: () => void
}

/** 上下文长度 → 紧凑展示（1000000 → 1M，262144 → 262K） */
function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`
  return String(tokens)
}

/**
 * AI 平台配置的新增/编辑弹框（字段一致，共用同一个弹框）。
 * 平台选项与预设模型均取自 GET /aiPlatforms/providers（不硬编码）；
 * 未选平台时模型下拉禁用，切换平台会清空已选模型。
 */
export function AiPlatformDialog({
  open,
  onOpenChange,
  platform = null,
  onSuccess,
}: AiPlatformDialogProps) {
  const isEdit = Boolean(platform)

  // 表单初值从传入配置惰性初始化（编辑预填、新增置空）；
  // 每次打开由父级变更 key 重新挂载本组件来重新初始化，避免在 effect 里同步 state。
  const [name, setName] = useState(() => platform?.name ?? '')
  const [provider, setProvider] = useState(() => platform?.provider ?? '')
  const [apiKey, setApiKey] = useState(() => platform?.apiKey ?? '')
  const [defaultModel, setDefaultModel] = useState(
    () => platform?.defaultModel ?? '',
  )

  // 支持的平台：打开弹框时才请求（与列表页同 key，缓存共享）
  const {
    data: providersData,
    isLoading: isProvidersLoading,
    isError: isProvidersError,
  } = useQuery({
    queryKey: aiPlatformQueryKeys.providers,
    queryFn: getAiPlatformProviders,
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const providers: AiPlatformProvider[] = providersData?.list ?? []
  const presetModels =
    providers.find((item) => item.key === provider)?.presetModels ?? []

  const createMutation = useMutation({ mutationFn: createAiPlatform })
  const updateMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: AiPlatformParams }) =>
      updateAiPlatform(id, params),
  })
  const isSaving = createMutation.isPending || updateMutation.isPending

  const canSubmit =
    name.trim() !== '' &&
    provider !== '' &&
    apiKey.trim() !== '' &&
    defaultModel !== ''

  // 切换平台后原模型可能不属于新平台，需清空重选
  const handleProviderChange = useCallback((value: string) => {
    setProvider(value)
    setDefaultModel('')
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim()
    const trimmedApiKey = apiKey.trim()
    if (!trimmedName || !provider || !trimmedApiKey || !defaultModel) return
    const params: AiPlatformParams = {
      name: trimmedName,
      provider,
      apiKey: trimmedApiKey,
      defaultModel,
    }
    try {
      if (platform) {
        await updateMutation.mutateAsync({ id: platform._id, params }) // 成功提示由拦截器处理
      } else {
        await createMutation.mutateAsync(params)
      }
      onOpenChange(false)
      onSuccess?.()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [
    name,
    provider,
    apiKey,
    defaultModel,
    platform,
    createMutation,
    updateMutation,
    onOpenChange,
    onSuccess,
  ])

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? '编辑 AI 平台配置' : '新增 AI 平台配置'}
      description={
        isEdit
          ? '修改后的配置将立即生效。'
          : '配置平台密钥与默认模型，用于调用该平台的大模型能力。'
      }
      confirmText={isEdit ? '保存' : '创建'}
      confirmLoading={isSaving}
      confirmDisabled={!canSubmit}
      onConfirm={handleSubmit}
    >
      <div className="flex flex-col gap-3 px-2.5 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-platform-name">名称</Label>
          <Input
            id="ai-platform-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="请输入配置名称"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-platform-provider">平台</Label>
          <Select
            value={provider || null}
            onValueChange={(value) =>
              handleProviderChange(typeof value === 'string' ? value : '')
            }
            disabled={isProvidersLoading}
          >
            <SelectTrigger id="ai-platform-provider" className="w-full">
              <SelectValue>
                {(value) => {
                  const key = typeof value === 'string' ? value : ''
                  if (!key) {
                    return (
                      <span className="text-muted-foreground">
                        {PROVIDER_PLACEHOLDER}
                      </span>
                    )
                  }
                  return providers.find((item) => item.key === key)?.label ?? key
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {providers.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-platform-model">默认模型</Label>
          <Select
            value={defaultModel || null}
            onValueChange={(value) =>
              setDefaultModel(typeof value === 'string' ? value : '')
            }
            disabled={provider === ''}
          >
            <SelectTrigger id="ai-platform-model" className="w-full">
              <SelectValue>
                {(value) => {
                  const modelId = typeof value === 'string' ? value : ''
                  if (!modelId) {
                    return (
                      <span className="text-muted-foreground">
                        {MODEL_PLACEHOLDER}
                      </span>
                    )
                  }
                  // 预设列表里没有时（如平台预设已调整）回退展示原值
                  return (
                    presetModels.find((model) => model.id === modelId)?.name ??
                    modelId
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {presetModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                  <span className="text-xs text-muted-foreground">
                    {formatContextLength(model.contextLength)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-platform-api-key">API Key</Label>
          <Input
            id="ai-platform-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="请输入平台 API Key"
            autoComplete="off"
          />
        </div>

        {isProvidersError ? (
          <p className="text-xs text-destructive">
            平台列表加载失败，请关闭后重试。
          </p>
        ) : null}
      </div>
    </AppDialog>
  )
}
