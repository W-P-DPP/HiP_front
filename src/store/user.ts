import { create } from 'zustand'

interface UserState {
  /** 当前登录用户 id（由 /users/profile 查询同步填充） */
  userId: string
  setUserId: (userId: string) => void
}

export const useUserStore = create<UserState>((set) => ({
  userId: '',
  setUserId: (userId) => set({ userId }),
}))
