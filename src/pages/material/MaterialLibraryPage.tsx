import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { MyMaterialsTab } from './MyMaterialsTab'
import { PublicMaterialsTab } from './PublicMaterialsTab'

/** 素材库：我的素材 / 公共素材 两个 tab；查询在各 tab 内容组件内，切换 tab 自动重新取数 */
export function MaterialLibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">素材库</h1>
        <p className="text-sm text-muted-foreground">管理你的素材文件与公共素材。</p>
      </div>
      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">我的素材</TabsTrigger>
          <TabsTrigger value="public">公共素材</TabsTrigger>
        </TabsList>
        <TabsContent value="my">
          <MyMaterialsTab />
        </TabsContent>
        <TabsContent value="public">
          <PublicMaterialsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
