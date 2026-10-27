import { useMemo } from 'react'
import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { WxArticleStatItem } from '@/types/wechat-summary'
import {
  aggregateDaily,
  aggregateSources,
  collectDayRows,
  formatCount,
  sumDayStats,
} from '@/utils/wechat-summary'

import { EngagementTrendChart, ReadTrendChart, SourceRankChart } from './WechatCharts'

interface WechatOverviewProps {
  articles: WxArticleStatItem[]
  beginDate: string
  endDate: string
}

/** 概览数据：区间合计 + 每日趋势 + 来源构成（图表写法遵守 dataviz：单序列/三分类色/来源用单色排行条） */
export function WechatOverview({ articles, beginDate, endDate }: WechatOverviewProps) {
  const rows = useMemo(() => collectDayRows(articles), [articles])
  const totals = useMemo(() => sumDayStats(rows), [rows])
  const daily = useMemo(() => aggregateDaily(rows, beginDate, endDate), [rows, beginDate, endDate])
  const sources = useMemo(() => aggregateSources(rows), [rows])

  const kpis = [
    { label: '覆盖文章', value: formatCount(articles.length) },
    { label: '阅读人数', value: formatCount(totals.read) },
    { label: '分享', value: formatCount(totals.share) },
    { label: '在看', value: formatCount(totals.zaikan) },
    { label: '点赞', value: formatCount(totals.like) },
    { label: '收藏', value: formatCount(totals.collection) },
    { label: '评论', value: formatCount(totals.comment) },
  ]

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader className="gap-1">
        <CardTitle>区间概览</CardTitle>
        <CardDescription>
          统计区间 {beginDate} ~ {endDate} · 数据为逐日明细加总
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{kpi.label}</span>
              <span className="text-2xl font-medium tabular-nums tracking-tight">
                {kpi.value}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartBlock
            title="每日阅读趋势"
            description={daily.length ? `区间内 ${daily.length} 天` : undefined}
          >
            <ReadTrendChart data={daily} />
          </ChartBlock>
          <ChartBlock
            title="每日互动趋势"
            description="在看 / 点赞 / 收藏"
          >
            <EngagementTrendChart data={daily} />
          </ChartBlock>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">阅读来源构成</h3>
            <p className="text-sm text-muted-foreground">按场景聚合（不含「全部」总计行）</p>
          </div>
          {sources.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              区间内暂无有阅读量的来源数据
            </p>
          ) : (
            <div className="max-w-3xl">
              <SourceRankChart sources={sources} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
