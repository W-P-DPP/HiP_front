import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

import { useUserProfile } from '@/hooks/use-user-profile'

import { useUserStore } from '@/store/user'

import { AppSidebar } from './AppSidebar'
import { SiteHeader } from './SiteHeader'

export function AdminLayout() {
  // 项目初始化后拉取当前用户资料，供侧边栏等展示
  const { data: profile } = useUserProfile()
  const setUserId = useUserStore((state) => state.setUserId)

  // 用户资料加载后把 userId 同步进客户端状态，供各页面读取
  useEffect(() => {
    if (profile?.id) setUserId(profile.id)
  }, [profile?.id, setUserId])

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
