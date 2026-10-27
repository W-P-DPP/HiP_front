import { useCallback, useState } from 'react'
import { BookOpenText, Clapperboard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { WxStatRange } from '@/types/wechat-summary'

import { WechatStatTab } from './WechatStatTab'
import { presetRange } from './wechat-range'

/**
 * 数据分析页（公众号 / 抖音 / 小红书）。
 * tab1 公众号：进入/切回时按所选区间取发表内容统计；日期区间状态提升到本组件，
 * 保证切换 tab 后回到公众号仍沿用上次区间并重新取数。
 * tab2/3：占位待实现。
 */
export function DataAnalyze() {
  const [range, setRange] = useState<WxStatRange>(() => presetRange(30))

  const applyPreset = useCallback((days: number) => {
    setRange(presetRange(days))
  }, [])

  const applyRange = useCallback((next: WxStatRange) => {
    setRange(next)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">数据分析</h1>
      </div> */}

      <Tabs defaultValue="wechat">
        <TabsList>
          <TabsTrigger value="wechat">公众号</TabsTrigger>
          <TabsTrigger value="douyin">抖音</TabsTrigger>
          <TabsTrigger value="xiaohongshu">小红书</TabsTrigger>
        </TabsList>
        <TabsContent value="wechat">
          <WechatStatTab
            range={range}
            onPreset={applyPreset}
            onApplyRange={applyRange}
          />
        </TabsContent>
        <TabsContent value="douyin">
          <ComingSoonTab icon={Clapperboard} title="抖音" />
        </TabsContent>
        <TabsContent value="xiaohongshu">
          <ComingSoonTab icon={BookOpenText} title="小红书" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ComingSoonTab({
  icon: Icon,
  title,
}: {
  icon: LucideIcon
  title: string
}) {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center xl bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{title}数据分析</p>
          <p className="text-sm text-muted-foreground">能力筹备中，敬请期待。</p>
        </div>
      </CardContent>
    </Card>
  )
}
