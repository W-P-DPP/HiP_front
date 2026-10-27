import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { login, register } from '@/api/auth'
import { userQueryKeys } from '@/api/user'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** 与后端 UserConstants 对齐的校验规则 */
const PASSWORD_MIN_LENGTH = 6
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^1[3-9]\d{9}$/

/** 账号须为邮箱或中国大陆手机号（镜像后端 isValidAccount） */
function isValidAccount(account: string): boolean {
  return EMAIL_REGEX.test(account) || PHONE_REGEX.test(account)
}

type AuthMode = 'login' | 'register'

/**
 * 登录 / 注册页（公开路由，不含后台布局）。
 * 复刻后端静态登录页的交互：两表单切换、错误内联展示。
 * 鉴权 cookie 由登录接口以 httpOnly 下发，前端不持久化 token；登录成功回 /dashboard（由 RequireAuth 守卫放行）。
 */
export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [loginAccount, setLoginAccount] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [registerAccount, setRegisterAccount] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirm, setRegisterConfirm] = useState('')

  const loginMutation = useMutation({ mutationFn: login })
  const registerMutation = useMutation({ mutationFn: register })

  const isPending =
    mode === 'login' ? loginMutation.isPending : registerMutation.isPending

  /** 切换表单时清空提示，避免残留上一个表单的错误/成功文案 */
  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const handleLogin = async () => {
    const account = loginAccount.trim()
    if (!account || !loginPassword) {
      setError('请输入账号和密码')
      return
    }
    setError('')
    setSuccess('')
    try {
      await loginMutation.mutateAsync({ account, password: loginPassword })
      // 清掉登录前可能残留的资料查询（如 401 错误态），让路由守卫从干净状态重新拉取
      queryClient.removeQueries({ queryKey: userQueryKeys.profile })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    }
  }

  const handleRegister = async () => {
    const account = registerAccount.trim()
    if (!account || !registerPassword || !registerConfirm) {
      setError('请填写完整信息')
      return
    }
    if (!isValidAccount(account)) {
      setError('请输入正确的邮箱或手机号')
      return
    }
    if (registerPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`密码长度不能少于 ${PASSWORD_MIN_LENGTH} 位`)
      return
    }
    if (registerPassword !== registerConfirm) {
      setError('两次输入的密码不一致')
      return
    }
    setError('')
    setSuccess('')
    try {
      await registerMutation.mutateAsync({ account, password: registerPassword })
      // 注册成功：带账号切回登录表单并提示
      setLoginAccount(account)
      setLoginPassword('')
      setRegisterPassword('')
      setRegisterConfirm('')
      switchMode('login')
      setSuccess('注册成功，请登录')
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请稍后重试')
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPending) return
    void (mode === 'login' ? handleLogin() : handleRegister())
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
            H
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">HiP</span>
        </div>

        <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)] [--card-spacing:--spacing(8)]">
          <CardHeader className="gap-1">
            <CardTitle className="text-xl">
              {mode === 'login' ? '登录' : '注册'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? '使用邮箱或手机号进入控制台。'
                : '创建账号后即可使用平台能力。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              {mode === 'login' ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="login-account">账号</Label>
                    <Input
                      id="login-account"
                      value={loginAccount}
                      onChange={(event) => setLoginAccount(event.target.value)}
                      placeholder="请输入邮箱或手机号"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="login-password">密码</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="register-account">账号</Label>
                    <Input
                      id="register-account"
                      value={registerAccount}
                      onChange={(event) => setRegisterAccount(event.target.value)}
                      placeholder="请输入邮箱或手机号"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="register-password">密码</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="请设置密码"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="register-confirm">确认密码</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={registerConfirm}
                      onChange={(event) => setRegisterConfirm(event.target.value)}
                      placeholder="请确认密码"
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              <p
                aria-live="polite"
                className={cn(
                  'min-h-5 text-sm',
                  error ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {error || success}
              </p>

              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {mode === 'login'
                  ? isPending
                    ? '登录中…'
                    : '登录'
                  : isPending
                    ? '注册中…'
                    : '注册'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? '还没有账号？' : '已有账号？'}
              <button
                type="button"
                className="ml-1 text-foreground underline-offset-4 hover:underline"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? '去注册' : '去登录'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
