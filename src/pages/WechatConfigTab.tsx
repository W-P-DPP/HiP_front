import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createWechatAccount,
  updateWechatAccount,
  wechatAccountQueryKeys,
} from '@/api/wechat-account'
import type { WechatAccountParams } from '@/api/wechat-account'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useWechatAccount } from '@/hooks/use-wechat-account'
import type { WechatAccount } from '@/types/wechat-account'
import type { RequestConfig } from '@/utils/axios'

/** 公众号配置 tab 内容：加载/错误 + 内联可编辑表单（无配置时亦展示空表单，保存走 POST 创建） */
export function WechatConfigTab() {
  const { data: account, isLoading, isError, refetch } = useWechatAccount()
  // 查询当前账号公众号配置：无数据 = 未配置（保存走新增），有数据 = 已配置（保存走更新）

  if (isLoading) return <WechatConfigSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm text-destructive">公众号配置加载失败，请稍后重试。</p>
        <Button variant="outline" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <WechatConfigForm
      key={account?._id ?? 'new'}
      account={account ?? null}
    />
  )
}

/** 内联可编辑表单；key 由父级用 account._id（无配置时为 'new'）驱动，账号变化时重挂载以重新初始化 */
function WechatConfigForm({ account }: { account: WechatAccount | null }) {
  const queryClient = useQueryClient()

  // 表单初值从服务端账号惰性初始化（密钥字段虽为 password 型，仍回显以便修改；无配置时为空表单）
  const [name, setName] = useState(() => account?.name ?? '')
  const [appId, setAppId] = useState(() => account?.appId ?? '')
  const [appSecret, setAppSecret] = useState(() => account?.appSecret ?? '')
  const [token, setToken] = useState(() => account?.token ?? '')
  const [encodingAESKey, setEncodingAESKey] = useState(
    () => account?.encodingAESKey ?? '',
  )
  const [formError, setFormError] = useState('')

  // 无配置走新增（POST），有配置走更新（PUT），两个 mutation 各自上报 pending
  const createMutation = useMutation({
    mutationFn: ({
      params,
      config,
    }: {
      params: WechatAccountParams
      config?: RequestConfig
    }) => createWechatAccount(params, config),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: WechatAccountParams }) =>
      updateWechatAccount(id, params),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSave = useCallback(async () => {
    // 后端接口要求五个字段全部提交，空值视为校验不通过
    const values = { name, appId, appSecret, token, encodingAESKey }
    if (Object.values(values).some((value) => !value.trim())) {
      setFormError('请填写全部配置项')
      return
    }
    setFormError('')
    const params: WechatAccountParams = {
      name: name.trim(),
      appId: appId.trim(),
      appSecret: appSecret.trim(),
      token: token.trim(),
      encodingAESKey: encodingAESKey.trim(),
    }
    try {
      if (account) {
        // 已有配置：按账号 _id 走更新接口
        await updateMutation.mutateAsync({ id: account._id, params }) // 成功提示由拦截器处理
      } else {
        // 无配置：走新增接口完成首次配置，成功文案覆盖默认的「更新成功」
        await createMutation.mutateAsync({
          params,
          config: { successMessage: '公众号配置已保存' },
        })
      }
      queryClient.invalidateQueries({ queryKey: wechatAccountQueryKeys.list })
    } catch {
      // 失败提示已由拦截器统一处理
    }
  }, [name, appId, appSecret, token, encodingAESKey, account, createMutation, updateMutation, queryClient])

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <CardTitle>公众号配置</CardTitle>
        <CardDescription>
          配置微信公众号接入信息，用于接收公众号消息推送。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wechat-name">公众号名称</Label>
            <Input
              id="wechat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入公众号名称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wechat-app-id">AppID</Label>
            <Input
              id="wechat-app-id"
              value={appId}
              onChange={(event) => setAppId(event.target.value)}
              placeholder="请输入应用 ID"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wechat-app-secret">AppSecret</Label>
            <Input
              id="wechat-app-secret"
              type="password"
              value={appSecret}
              onChange={(event) => setAppSecret(event.target.value)}
              placeholder="请输入应用密钥"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wechat-token">Token</Label>
            <Input
              id="wechat-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="请输入 Token"
            />
            <p className="text-xs text-muted-foreground">
              在公众号后台「服务器配置」中获取。
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wechat-encoding-aes-key">EncodingAESKey</Label>
            <Input
              id="wechat-encoding-aes-key"
              type="password"
              value={encodingAESKey}
              onChange={(event) => setEncodingAESKey(event.target.value)}
              placeholder="请输入消息加密密钥"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">43 位随机字符串。</p>
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" disabled={isSaving} onClick={handleSave}>
          {isSaving ? '保存中…' : '保存'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function WechatConfigSkeleton() {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
