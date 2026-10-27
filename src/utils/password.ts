import { JSEncrypt } from 'jsencrypt'

import { RSA_PUBLIC_KEY } from '@/constant/crypto'

// 复用单个实例，避免每次加密都重新解析公钥
let encryptor: JSEncrypt | null = null

/**
 * 用后端 RSA 公钥加密密码，返回 base64 密文。
 * 用 jsencrypt 的 encrypt()（PKCS#1 v1.5）——其 encryptOAEP 与 Node 的
 * RSA_PKCS1_OAEP_PADDING 不互通，故后端必须按 RSA_PKCS1_PADDING 解密。
 * 加密失败直接抛错：密码绝不能回退成明文提交。
 */
export function encryptPassword(plain: string): string {
  if (!encryptor) {
    encryptor = new JSEncrypt()
    encryptor.setPublicKey(RSA_PUBLIC_KEY)
  }
  const encrypted = encryptor.encrypt(plain)
  if (!encrypted) throw new Error('密码加密失败，请重试')
  return encrypted
}
