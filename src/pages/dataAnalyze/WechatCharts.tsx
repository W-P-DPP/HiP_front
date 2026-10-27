import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { WxReadJumpPosition } from '@/types/wechat-summary'
import { formatCount } from '@/utils/wechat-summary'
import type { WxDailyRow, WxSourceRow } from '@/utils/wechat-summary'

/** 阅读趋势（单序列 Area），单序列不需要图例 */
const READ_CONFIG = {
  read: { label: '阅读人数', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** 互动趋势多折线：项目调色板仅 3 个分类色（蓝/橙/绿），故取在看/点赞/收藏三个主互动量 */
const ENGAGE_CONFIG = {
  zaikan: { label: '在看', color: 'var(--chart-1)' },
  like: { label: '点赞', color: 'var(--chart-2)' },
  collection: { label: '收藏', color: 'var(--chart-3)' },
} satisfies ChartConfig

/** 阅读来源排行（单色横向条形 + 端值标签，身份由标签承担而非颜色） */
const SOURCE_CONFIG = {
  count: { label: '阅读人数', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** 阅读位置分布（单色柱） */
const POSITION_CONFIG = {
  pct: { label: '读者占比', color: 'var(--chart-2)' },
} satisfies ChartConfig

const DATE_TICK = (value: string) => value.slice(5)

export function ReadTrendChart({ data }: { data: WxDailyRow[] }) {
  return (
    <ChartContainer config={READ_CONFIG} className="h-60 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={DATE_TICK}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="read"
          type="monotone"
          stroke="var(--color-read)"
          fill="var(--color-read)"
          fillOpacity={0.14}
          strokeWidth={2}
          dot={data.length < 2}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function EngagementTrendChart({ data }: { data: WxDailyRow[] }) {
  return (
    <ChartContainer config={ENGAGE_CONFIG} className="h-60 w-full">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={DATE_TICK}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="zaikan" type="monotone" stroke="var(--color-zaikan)" strokeWidth={2} dot={data.length < 2} />
        <Line dataKey="like" type="monotone" stroke="var(--color-like)" strokeWidth={2} dot={data.length < 2} />
        <Line dataKey="collection" type="monotone" stroke="var(--color-collection)" strokeWidth={2} dot={data.length < 2} />
      </LineChart>
    </ChartContainer>
  )
}

/** 阅读来源排行：按场景降序的横向条形，直接端值标签，超过标签宽度的折叠在图例外的 title 提示 */
export function SourceRankChart({ sources }: { sources: WxSourceRow[] }) {
  const data = sources.map((source) => ({ scene: source.scene, count: source.count }))
  return (
    <ChartContainer config={SOURCE_CONFIG} className="h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 36, top: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="scene"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={110}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={14}>
          <LabelList
            dataKey="count"
            position="right"
            formatter={(value) => formatCount(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** 阅读位置分布（读到第 N 段即停止的读者占比），rate ∈ [0,1] */
export function ReadPositionChart({ positions }: { positions: WxReadJumpPosition[] }) {
  const data = positions.map((item) => ({
    label: `第${item.position}段`,
    pct: Math.round(item.rate * 1000) / 10,
  }))
  return (
    <ChartContainer config={POSITION_CONFIG} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}%`}
          domain={[0, 100]}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value)}%`} />} />
        <Bar dataKey="pct" fill="var(--color-pct)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
  )
}
