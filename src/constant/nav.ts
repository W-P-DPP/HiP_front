import { EROLE } from '@/hooks/use-permission'
import { AudioLines, Clapperboard, FileAudio, FileVideo, FlaskConical,KeyRound, LayoutDashboard, Library, Mic2, Scissors, Subtitles, Users, BicepsFlexed } from 'lucide-react'

/** 侧边栏主导航菜单配置 */
export const NAV_ITEMS = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard, role: EROLE.user },
  { href: '/users', label: '用户', icon: Users, role: EROLE.admin },
  // { href: '/voice-training', label: '音色库', icon: Mic2, role: EROLE.user },
  { href: '/voice-training-v2', label: '音色库', icon: Mic2, role: EROLE.user },
  { href: '/digital-human', label: '数字人', icon: AudioLines, role: EROLE.user },
  { href: '/materials', label: '素材库', icon: Library, role: EROLE.user },
  { href: '/data-analyze', label: '数据分析', icon: FlaskConical, role: EROLE.admin },
] as const

/** 侧边栏「我的账户」分组菜单配置 */
export const ACCOUNT_ITEMS = [
  { href: '/account/api-keys', label: 'API 密钥管理', icon: KeyRound, role: EROLE.user },
  { href: '/account/synthesis-records', label: '音色合成记录', icon: FileAudio, role: EROLE.user },
  { href: '/account/subtitle-records', label: '字幕合成记录', icon: Subtitles, role: EROLE.user },
  { href: '/account/digital-human-records', label: '数字人合成记录', icon: FileVideo, role: EROLE.user },
  { href: '/account/scene-split-records', label: 'AI解说记录', icon: Scissors, role: EROLE.user },
  { href: '/account/narration-video-records', label: '视频解说记录', icon: Clapperboard, role: EROLE.user },
  { href: '/exec-record', label: '短视频合成记录', icon: BicepsFlexed, role: EROLE.user },
  { href: '/work-room', label: '工作台', icon: BicepsFlexed, role: EROLE.user },
] as const

/** 路由路径 → 页面标题（顶栏面包屑用） */
export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/users': '用户',
  // '/voice-training': '音色库',
  '/voice-training/create': '新增音色',
  '/voice-training-v2': '音色库V2',
  '/digital-human': '数字人',
  '/materials': '素材库',
  '/account/api-keys': 'API 密钥管理',
  '/account/synthesis-records': '音色合成记录',
  '/account/subtitle-records': '字幕合成记录',
  '/account/digital-human-records': '数字人合成记录',
  '/account/scene-split-records': '场景切分记录',
  '/account/narration-video-records': '视频解说记录',
  '/account/profile': '个人资料',
  '/exec-record': '短视频合成记录',
  '/data-analyze': '数据分析',
  '/work-room': '工作台',
  '/work-room/chat': '智能对话',
  '/work-room/digital-human': '数字人工厂',
  '/work-room/short-video': '短视频工厂',
  '/work-room/subtitle': '字幕合成',
  '/work-room/image-understand': '图像理解',
  '/work-room/scene-split': 'AI解说',
}
