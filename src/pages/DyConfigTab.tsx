import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createDyAccount,
  dyAccountQueryKeys,
  updateDyAccount,
} from '@/api/dy-account'
import type { DyAccountParams } from '@/api/dy-account'
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
import { useDyAccount } from '@/hooks/use-dy-account'
import type { DyAccount } from '@/types/dy-account'
import type { RequestConfig } from '@/utils/axios'

/** 抖音应用配置 tab 内容：加载/错误 + 内联可编辑表单（无配置时亦展示空表单，保存走 POST 创建） */
export function DyConfigTab() {
  const { data: account, isLoading, isError, refetch } = useDyAccount()
  // 查询当前用户抖音配置：null = 未配置（保存走新增），有数据 = 已配置（保存走更新）

  if (isLoading) return <DyConfigSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm text-destructive">抖音应用配置加载失败，请稍后重试。</p>
        <Button variant="outline" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    )
  }

  return <DyConfigForm key={account?._id ?? 'new'} account={account ?? null} />
}

/** 内联可编辑表单；key 由父级用 account._id（无配置时为 'new'）驱动，配置变化时重挂载以重新初始化 */
function DyConfigForm({ account }: { account: DyAccount | null }) {
  const queryClient = useQueryClient()

  // 表单初值从服务端配置惰性初始化（密钥字段虽为 password 型，仍回显以便修改；无配置时为空表单）
  const [name, setName] = useState(() => account?.name ?? '')
  const [clientKey, setClientKey] = useState(() => account?.clientKey ?? '')
  const [clientSecret, setClientSecret] = useState(
    () => account?.clientSecret ?? '',
  )
  const [formError, setFormError] = useState('')

  // 无配置走新增（POST），有配置走更新（PUT），两个 mutation 各自上报 pending
  const createMutation = useMutation({
    mutationFn: ({
      params,
      config,
    }: {
      params: DyAccountParams
      config?: RequestConfig
    }) => createDyAccount(params, config),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: DyAccountParams }) =>
      updateDyAccount(id, params),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSave = useCallback(async () => {
    // 后端接口要求三个字段全部提交，空值视为校验不通过
    const values = { name, clientKey, clientSecret }
    if (Object.values(values).some((value) => !value.trim())) {
      setFormError('请填写全部配置项')
      return
    }
    setFormError('')
    const params: DyAccountParams = {
      name: name.trim(),
      clientKey: clientKey.trim(),
      clientSecret: clientSecret.trim(),
    }
    try {
      if (account) {
        // 已有配置：按配置 _id 走更新接口
        await updateMutation.mutateAsync({ id: account._id, params }) // 成功提示由拦截器处理
      } else {
        // 无配置：走新增接口完成首次配置，成功文案覆盖默认的「创建成功」
        await createMutation.mutateAsync({
          params,
          config: { successMessage: '抖音应用配置已保存' },
        })
      }
      queryClient.invalidateQueries({ queryKey: dyAccountQueryKeys.mine })
    } catch {
      // 失败提示已由拦截器统一处理
    }
  }, [
    name,
    clientKey,
    clientSecret,
    account,
    createMutation,
    updateMutation,
    queryClient,
  ])

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <CardTitle>抖音应用配置</CardTitle>
        <CardDescription>
          配置抖音开放平台应用信息，用于对接抖音相关能力。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dy-name">应用名称</Label>
            <Input
              id="dy-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入应用名称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dy-client-key">ClientKey</Label>
            <Input
              id="dy-client-key"
              value={clientKey}
              onChange={(event) => setClientKey(event.target.value)}
              placeholder="请输入 ClientKey"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dy-client-secret">ClientSecret</Label>
            <Input
              id="dy-client-secret"
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder="请输入 ClientSecret"
              autoComplete="off"
            />
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

function DyConfigSkeleton() {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
