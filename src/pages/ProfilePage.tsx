import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  updateUserProfile,
  uploadAvatar,
  userQueryKeys,
} from '@/api/user'
import type { UpdateUserProfileParams } from '@/api/user'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserProfile } from '@/hooks/use-user-profile'
import { AiPlatformConfigTab } from '@/pages/AiPlatformConfigTab'
import { DyConfigTab } from '@/pages/DyConfigTab'
import { WechatConfigTab } from '@/pages/WechatConfigTab'
import type { UserProfile } from '@/types/user'

const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB
const PASSWORD_MIN_LENGTH = 6

function isValidPassword(value: string) {
  return value.length >= PASSWORD_MIN_LENGTH
}

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">个人资料</h1>
        <p className="text-sm text-muted-foreground">
          管理你的个人资料、AI 平台、公众号与抖音应用配置。
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="ai-platform">AI 平台配置</TabsTrigger>
          <TabsTrigger value="wechat">公众号配置</TabsTrigger>
          <TabsTrigger value="dy">抖音应用配置</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileInfoTab />
        </TabsContent>
        <TabsContent value="ai-platform">
          <AiPlatformConfigTab />
        </TabsContent>
        <TabsContent value="wechat">
          <WechatConfigTab />
        </TabsContent>
        <TabsContent value="dy">
          <DyConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** 个人资料 tab 内容；查询放在本组件内，切走卸载、切回重挂会重新获取资料 */
function ProfileInfoTab() {
  const { data: profile, isLoading, isError, refetch } = useUserProfile()

  return (
    <>
      {isLoading && <ProfileSkeleton />}

      {isError && (
        <div className="flex flex-col items-start gap-3 xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">个人资料加载失败，请稍后重试。</p>
          <Button variant="outline" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      {profile && <ProfileForm key={profile.id} profile={profile} />}
    </>
  )
}

/** 内联可编辑表单；key 由父级用 profile.id 驱动，资料变化时重挂载以重新初始化 */
function ProfileForm({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient()

  // 表单初值从服务端资料惰性初始化（password 故意不回显：留空 = 不修改）
  const [nickname, setNickname] = useState(() => profile.nickname)
  const [avatar, setAvatar] = useState<string | undefined>(() => profile.avatar)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 清理本地预览 blob URL，避免内存泄漏
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const uploadMutation = useMutation({ mutationFn: uploadAvatar })
  const updateMutation = useMutation({
    mutationFn: (params: UpdateUserProfileParams) =>
      updateUserProfile(profile.id, params),
  })

  const handleAvatarChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      event.target.value = '' // 清空 value，允许重复选择同一文件
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setAvatarError('请选择图片文件')
        return
      }
      if (file.size > AVATAR_MAX_SIZE) {
        setAvatarError('图片大小不能超过 2MB')
        return
      }
      setAvatarError('')
      setAvatarFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      try {
        const avatarUrl = await uploadMutation.mutateAsync(file)
        setAvatar(avatarUrl)
        setPreviewUrl(undefined) // 上传成功，丢弃本地预览
      } catch {
        // 失败提示已由拦截器 toast；丢弃本地预览，保留原头像
        setPreviewUrl(undefined)
      } finally {
        setAvatarFile(null)
      }
    },
    [uploadMutation],
  )

  const handleSave = useCallback(async () => {
    const name = nickname.trim()
    if (!name) return
    if (password && !isValidPassword(password)) {
      setPasswordError(`密码长度至少 ${PASSWORD_MIN_LENGTH} 位`)
      return
    }
    setPasswordError('')
    const body: UpdateUserProfileParams = {
      nickname: name,
      avatar,
      ...(password ? { password } : {}), // 未填密码则不改密码
    }
    try {
      await updateMutation.mutateAsync(body) // 成功 toast「更新成功」由拦截器处理
      setPassword('') // 成功后清空，避免误触发二次改密
      queryClient.invalidateQueries({ queryKey: userQueryKeys.profile })
    } catch {
      // 失败提示已由拦截器统一处理
    }
  }, [nickname, password, avatar, updateMutation, queryClient])

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <Avatar className="size-20">
            <AvatarImage src={previewUrl ?? avatar} />
            <AvatarFallback>
              {(nickname || profile.account).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? '上传中…' : '更换头像'}
            </Button>
            {avatarFile && (
              <span className="text-xs text-muted-foreground">
                {avatarFile.name}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              支持 jpg、png 等图片格式，大小不超过 2MB。
            </p>
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-account">账号</Label>
            <Input id="profile-account" value={profile.account} disabled />
            <p className="text-xs text-muted-foreground">登录账号，不可修改。</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-id">用户 ID</Label>
            <Input id="profile-id" value={profile.id} disabled />
            <p className="text-xs text-muted-foreground">用户唯一标识，不可修改。</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>角色</Label>
            <div className="flex h-9 items-center">
              <Badge variant="secondary">{profile.role}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-nickname">昵称</Label>
            <Input
              id="profile-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="请输入昵称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-password">密码</Label>
            <Input
              id="profile-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (passwordError) setPasswordError('')
              }}
              placeholder="留空则保持不变"
              autoComplete="new-password"
            />
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          type="button"
          disabled={updateMutation.isPending}
          onClick={handleSave}
        >
          {updateMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
      <CardHeader className="gap-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
