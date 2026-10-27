import type { ComponentProps } from 'react'
import { ChevronsUpDown, LogOut, User } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { ACCOUNT_ITEMS, NAV_ITEMS } from '@/constant/nav'
import type { UserProfile } from '@/types/user'

import logo from '@/assets/logo.png'

import { useLogout } from '@/hooks/use-logout'
import { useCloudVersion } from '@/hooks/use-cloud-version'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { hasPermission } from '@/hooks/use-permission'

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  profile?: UserProfile
}

export function AppSidebar({ profile, ...props }: AppSidebarProps) {
  const { pathname } = useLocation()
  const handleLogout = useLogout()
  const { data: cloudVersion } = useCloudVersion()
  const displayName = profile?.nickname ?? '--'
  const displayAccount = profile?.account ?? '--'
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" />}>
              <img
                src={logo}
                alt="HiP"
                className="h-8 w-auto shrink-0 object-contain object-left h-[50%]"
              />
              {cloudVersion && (
                <span className="flex flex-1 items-baseline gap-1.5 text-left text-xs font-normal text-sidebar-foreground/60">
                  {cloudVersion.local_version}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) =>{
                return hasPermission(item.role)? (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={pathname === item.href}
                    render={<NavLink to={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ):""
              }
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>我的账户</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACCOUNT_ITEMS.map((item) => {
                return hasPermission(item.role) ? (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={pathname === item.href}
                      render={<NavLink to={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : ""
              }
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="w-full" />}
              >
                <Avatar className="size-8 rounded-lg">
                  {profile?.avatar && (
                    <AvatarImage
                      src={profile.avatar}
                      className="rounded-lg"
                    />
                  )}
                  <AvatarFallback className="rounded-lg">
                    {profile ? displayName.charAt(0) : 'HF'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  {displayAccount && (
                    <span className="truncate text-xs text-muted-foreground">
                      {displayAccount}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={4}
                className="w-auto min-w-56 xl"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>我的账号</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<NavLink to="/account/profile" />}>
                  <User className="size-4" />
                  个人资料
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
