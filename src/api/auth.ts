import { getServiceBaseURL, post } from '@/utils/axios'
import { encryptPassword } from '@/utils/password'

/** 登录入参（POST /auth/login） */
export interface LoginParams {
  /** 邮箱或手机号 */
  account: string
  password: string
}

/** 登录返回：token 同时由后端写入 httpOnly cookie，前端无需再持久化 */
export interface LoginResult {
  token: string
}

/**
 * 登录（POST /hip/auth/login）。
 * 该接口挂在服务前缀（不带 /api）下，故用 getServiceBaseURL() 覆盖请求 base；
 * 鉴权 cookie 由后端 httpOnly 下发，本 SPA 靠 cookie 鉴权，无需写 JS cookie。
 * 密码先用后端 RSA 公钥加密，报文中不出现明文。
 * silent：登录失败由页面内联展示，不走全局 toast。
 */
export const login = async (params: LoginParams) =>
  post<LoginResult>(
    '/auth/login',
    { account: params.account, password: encryptPassword(params.password) },
    {
      baseURL: getServiceBaseURL(),
      silent: true,
    },
  )

/** 注册入参（POST /auth/register） */
export interface RegisterParams {
  /** 邮箱或手机号 */
  account: string
  password: string
}

/** 注册新账号（POST /hip/auth/register，密码同样 RSA 加密；silent 同上，结果由页面内联提示） */
export const register = async (params: RegisterParams) =>
  post<unknown>(
    '/auth/register',
    { account: params.account, password: encryptPassword(params.password) },
    {
      baseURL: getServiceBaseURL(),
      silent: true,
    },
  )
