import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import type { LucideIcon } from 'lucide-react'
import {
  CircuitBoard,
  Clapperboard,
  Cpu,
  HardDrive,
  MemoryStick,
  // Mic,
  RotateCw,
  Server,
  // Subtitles,
  UserRound,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useSystemResources,
  type SystemResourceSample,
} from '@/hooks/use-system-resources'
import {
  useQueueStatusTrend,
  type QueueStatusPoint,
} from '@/hooks/use-queue-status'
import { getUserStats, userQueryKeys } from '@/api/user'
import { digitalHumanQueryKeys, getDigitalHumanQueueStatus } from '@/api/digital-human'
// import { getSubtitleQueueStatus, subtitleQueryKeys } from '@/api/subtitle'
import {
  getVideoPipelineV2QueueStatus,
  videoPipelineV2QueryKeys,
} from '@/api/video-pipeline-v2'
// import {
//   getVoiceTrainV2QueueStatus,
//   voiceTrainV2QueryKeys,
// } from '@/api/voice-train-v2'
import type {
  CpuUsage,
  DiskInfo,
  GpuInfo,
  MemoryUsage,
  ProcessInfo,
} from '@/types/system'
import type { UserStats } from '@/types/user'
import { formatBytes } from '@/utils/format'
import { hasPermission, ROLE, usePermission } from '@/hooks/use-permission'

/** 卡片标题左侧的小圆角图标块 */
function CardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex size-10 items-center justify-center xl bg-muted">
      <Icon className="size-5 text-muted-foreground" />
    </div>
  )
}

/** 指标项：label + 等宽数字值 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-medium tabular-nums">{value}</span>
    </div>
  )
}

/** 卡片通用容器：大圆角 + 柔和阴影 + 内边距 */
function ResourceCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'rounded-[2.5rem] p-8 shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]',
        className,
      )}
    >
      <CardContent className="flex flex-col gap-6 pt-0">{children}</CardContent>
    </Card>
  )
}

/** 趋势点尚不足两个、尚未成线时的占位（高度与图表一致，避免布局跳动） */
function ChartCollecting({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center xl bg-muted/40 text-sm text-muted-foreground',
        className,
      )}
    >
      正在采集数据…
    </div>
  )
}

/** 磁盘分区环颜色：按分区顺序取图表令牌（chart-4/5 为中性深灰，作兜底） */
const RESOURCE_CHART_TOKENS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/** X 轴刻度：把 HH:mm:ss 收敛为 HH:mm */
const TIME_TICK_FORMATTER = (value: string) => value.slice(0, 5)

/** 使用率折线 Y 轴刻度（%） */
const PERCENT_TICK_FORMATTER = (value: number) => `${value}%`

const CPU_CHART_CONFIG = {
  cpu: { label: 'CPU 使用率 (%)', color: 'var(--chart-1)' },
} satisfies ChartConfig

const MEMORY_CHART_CONFIG = {
  used: { label: '已用', color: 'var(--chart-1)' },
  free: { label: '空闲', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

const GPU_CHART_CONFIG = {
  utilizationPercent: { label: '利用率 (%)', color: 'var(--chart-1)' },
  temperature: { label: '温度 (°C)', color: 'var(--chart-2)' },
} satisfies ChartConfig

interface CpuChartPoint {
  time: string
  cpu: number
}

interface GpuChartPoint {
  time: string
  utilizationPercent: number
  temperature: number
}

function CpuCard({
  cpu,
  samples,
}: {
  cpu: CpuUsage
  samples: SystemResourceSample[]
}) {
  const data: CpuChartPoint[] = samples.map((sample) => ({
    time: sample.time,
    cpu: sample.cpu,
  }))

  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={Cpu} />
        <CardTitle className="text-lg">CPU</CardTitle>
      </div>
      <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">
        {cpu.usagePercent.toFixed(1)}%
      </span>
      <CardDescription>处理器实时使用率趋势（5 秒刷新）</CardDescription>
      {data.length < 2 ? (
        <ChartCollecting className="aspect-[16/8]" />
      ) : (
        <ChartContainer config={CPU_CHART_CONFIG} className="aspect-[16/8] w-full">
          <LineChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={TIME_TICK_FORMATTER}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={PERCENT_TICK_FORMATTER}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              }
            />
            <Line
              dataKey="cpu"
              type="monotone"
              stroke="var(--color-cpu)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </ResourceCard>
  )
}

function MemoryCard({ memory }: { memory: MemoryUsage }) {
  // 数据项上的 fill 由 recharts 3.x 直接作为扇区填充色（无需 Cell）
  const donutData = [
    { name: '已用', value: memory.used, fill: 'var(--color-used)' },
    { name: '空闲', value: memory.free, fill: 'var(--color-free)' },
  ]

  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={MemoryStick} />
        <CardTitle className="text-lg">内存</CardTitle>
      </div>
      <div className="relative">
        <ChartContainer
          config={MEMORY_CHART_CONFIG}
          className="mx-auto aspect-[1/1] w-full max-w-52"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatBytes(Number(value))}
                />
              }
            />
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-4xl font-bold tracking-tight tabular-nums">
            {memory.percent.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">已使用</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-1)]" />
          已用
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--muted-foreground)]" />
          空闲
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Metric label="已用" value={formatBytes(memory.used)} />
        <Metric label="空闲" value={formatBytes(memory.free)} />
        <Metric label="总计" value={formatBytes(memory.total)} />
      </div>
    </ResourceCard>
  )
}

/** 单个分区环形占用：已用/空闲两段 + 居中百分比，下方挂载点与用量 */
function DiskRing({ info, color }: { info: DiskInfo; color: string }) {
  const config = useMemo<ChartConfig>(
    () => ({
      used: { label: '已用', color },
      free: { label: '空闲', color: 'var(--muted-foreground)' },
    }),
    [color],
  )

  const ringData = useMemo(
    () => [
      { name: '已用', value: info.used, fill: 'var(--color-used)' },
      {
        name: '空闲',
        value: Math.max(info.total - info.used, 0),
        fill: 'var(--color-free)',
      },
    ],
    [info.used, info.total],
  )

  // 居中百分比与环形分段同源（used/total），避免与后端返回的整数百分比四舍五入不一致
  const percent = info.total > 0 ? (info.used / info.total) * 100 : 0

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-36">
        <ChartContainer config={config} className="mx-auto aspect-[1/1] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatBytes(Number(value))}
                />
              }
            />
            <Pie
              data={ringData}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="92%"
              paddingAngle={2}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">
            {percent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="font-mono text-sm">{info.mount}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatBytes(info.used)} / {formatBytes(info.total)}
        </span>
      </div>
    </div>
  )
}

function DiskCard({ disk }: { disk: DiskInfo[] }) {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={HardDrive} />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-lg">磁盘</CardTitle>
          <CardDescription>
            共 {disk.length} 个分区 · 使用率（5 秒刷新）
          </CardDescription>
        </div>
      </div>
      {disk.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无磁盘数据</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-6 gap-y-8">
          {disk.map((info, index) => (
            <DiskRing
              key={info.mount}
              info={info}
              color={RESOURCE_CHART_TOKENS[index % RESOURCE_CHART_TOKENS.length]}
            />
          ))}
        </div>
      )}
    </ResourceCard>
  )
}

/** GPU 指标项：大号数值 */
function GpuMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </span>
    </div>
  )
}

function GpuBlock({
  info,
  index,
  samples,
}: {
  info: GpuInfo
  index: number
  samples: SystemResourceSample[]
}) {
  const chartData: GpuChartPoint[] = samples.flatMap((sample) => {
    const snapshot = sample.gpus[info.name]
    return snapshot
      ? [
          {
            time: sample.time,
            utilizationPercent: snapshot.utilizationPercent,
            temperature: snapshot.temperature,
          },
        ]
      : []
  })

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-muted/40 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{info.name}</span>
        <Badge variant="secondary">GPU {index + 1}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <GpuMetric
          label="利用率"
          value={`${info.utilizationPercent.toFixed(1)}%`}
        />
        <GpuMetric label="温度" value={`${info.temperature}°C`} />
        <GpuMetric label="显存占用" value={`${info.memory.percent.toFixed(1)}%`} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>显存</span>
          <span className="tabular-nums">
            {formatBytes(info.memory.used)} / {formatBytes(info.memory.total)}
          </span>
        </div>
        <Progress value={info.memory.percent} />
      </div>
      {chartData.length < 2 ? (
        <ChartCollecting className="aspect-[16/9]" />
      ) : (
        <ChartContainer config={GPU_CHART_CONFIG} className="aspect-[16/9] w-full">
          <LineChart data={chartData} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={TIME_TICK_FORMATTER}
            />
            <YAxis
              domain={[0, 100]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="utilizationPercent"
              type="monotone"
              stroke="var(--color-utilizationPercent)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="temperature"
              type="monotone"
              stroke="var(--color-temperature)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}

function GpuCard({
  gpu,
  samples,
}: {
  gpu: GpuInfo[]
  samples: SystemResourceSample[]
}) {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={CircuitBoard} />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-lg">GPU</CardTitle>
          <CardDescription>
            共 {gpu.length} 个 GPU · 利用率 / 温度趋势（5 秒刷新）
          </CardDescription>
        </div>
      </div>
      {gpu.length === 0 ? (
        <p className="text-sm text-muted-foreground">未检测到 GPU</p>
      ) : (
        <div className="flex flex-col gap-6">
          {gpu.map((info, index) => (
            <GpuBlock
              key={`${info.name}-${index}`}
              info={info}
              index={index}
              samples={samples}
            />
          ))}
        </div>
      )}
    </ResourceCard>
  )
}

function ProcessCard({ process }: { process: ProcessInfo }) {
  return (
    <ResourceCard className="lg:col-span-2">
      <div className="flex items-center gap-3">
        <CardIcon icon={Server} />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-lg">运行进程</CardTitle>
          <CardDescription>Node 服务进程资源占用</CardDescription>
        </div>
        <Badge variant="outline" className="ml-auto">
          {process.platform}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Metric label="RSS" value={formatBytes(process.memory.rss)} />
        <Metric label="堆内存占用" value={formatBytes(process.memory.heapUsed)} />
        <Metric label="堆总大小" value={formatBytes(process.memory.heapTotal)} />
        <Metric label="外部内存" value={formatBytes(process.memory.external)} />
      </div>
    </ResourceCard>
  )
}

const QUEUE_CHART_CONFIG = {
  pending: { label: '等待中', color: 'var(--chart-1)' },
  running: { label: '运行中', color: 'var(--chart-2)' },
  total: { label: '总任务', color: 'var(--chart-3)' },
} satisfies ChartConfig

/** 队列任务数趋势卡：与 CPU 卡同尺寸（单列 + 16:8 折线） */
function QueueStatusCard({
  icon,
  title,
  data,
}: {
  icon: LucideIcon
  title: string
  data: QueueStatusPoint[]
}) {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={icon} />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>任务数趋势（10 秒刷新）</CardDescription>
        </div>
      </div>
      {data.length < 2 ? (
        <ChartCollecting className="aspect-[16/8]" />
      ) : (
        <ChartContainer config={QUEUE_CHART_CONFIG} className="aspect-[16/8] w-full">
          <LineChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={TIME_TICK_FORMATTER}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="pending"
              type="monotone"
              stroke="var(--color-pending)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="running"
              type="monotone"
              stroke="var(--color-running)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="total"
              type="monotone"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </ResourceCard>
  )
}

function QueueStatusCardSkeleton() {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <Skeleton className="aspect-[16/8] w-full xl" />
    </ResourceCard>
  )
}

const USER_DAILY_NEW_CHART_CONFIG = {
  count: { label: '新增用户', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** X 轴刻度：把 YYYY-MM-DD 收敛为 MM-DD */
const DATE_TICK_FORMATTER = (value: string) => value.slice(5)

/** 用户统计卡（仅 sadmin 可见）：总数 + 今日新增 + 每日新增趋势 */
function UserStatsCard({ stats }: { stats: UserStats }) {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <CardIcon icon={Users} />
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-lg">用户统计</CardTitle>
          <CardDescription>
            账号总数与每日新增（近 {stats.dailyNew.length} 天）
          </CardDescription>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="flex flex-col gap-1">
          <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">
            {stats.total}
          </span>
          <span className="text-sm text-muted-foreground">用户总数</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">
            {stats.newToday}
          </span>
          <span className="text-sm text-muted-foreground">今日新增</span>
        </div>
      </div>
      <Separator />
      <ChartContainer
        config={USER_DAILY_NEW_CHART_CONFIG}
        className="aspect-[16/8] w-full"
      >
        <LineChart data={stats.dailyNew} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={DATE_TICK_FORMATTER}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="count"
            type="monotone"
            stroke="var(--color-count)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </ResourceCard>
  )
}

function UserStatsCardSkeleton() {
  return (
    <ResourceCard>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <Skeleton className="h-12 w-28" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="aspect-[16/8] w-full xl" />
    </ResourceCard>
  )
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="rounded-[2.5rem] p-8 shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardContent className="flex flex-col items-center gap-4 pt-0 text-center">
        <div className="flex size-14 items-center justify-center xl bg-destructive/10">
          <Server className="size-6 text-destructive" />
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg text-destructive">
            系统资源加载失败
          </CardTitle>
          <CardDescription className="max-w-sm">
            无法获取系统资源，请检查后端服务后重试。
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          重试
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ResourceCard>
        <Skeleton className="size-10 xl" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="aspect-[16/8] w-full xl" />
      </ResourceCard>
      <ResourceCard>
        <Skeleton className="size-10 xl" />
        <Skeleton className="mx-auto aspect-[1/1] w-full max-w-52 rounded-full" />
        <Skeleton className="mx-auto h-4 w-40" />
      </ResourceCard>
      <ResourceCard>
        <Skeleton className="size-10 xl" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="mx-auto aspect-[1/1] w-full max-w-36 rounded-full" />
          <Skeleton className="mx-auto aspect-[1/1] w-full max-w-36 rounded-full" />
        </div>
      </ResourceCard>
      <ResourceCard>
        <Skeleton className="size-10 xl" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-44 w-full rounded-3xl" />
      </ResourceCard>
      <ResourceCard className="lg:col-span-2">
        <Skeleton className="size-10 xl" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
      </ResourceCard>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useSystemResources()
  const videoQueue = useQueueStatusTrend(
    videoPipelineV2QueryKeys.queueStatus,
    getVideoPipelineV2QueueStatus,
  )
  // const voiceQueue = useQueueStatusTrend(
  //   voiceTrainV2QueryKeys.queueStatus,
  //   getVoiceTrainV2QueueStatus,
  // )
  // const subtitleQueue = useQueueStatusTrend(
  //   subtitleQueryKeys.queueStatus,
  //   getSubtitleQueueStatus,
  // )
  const digitalHumanQueue = useQueueStatusTrend(
    digitalHumanQueryKeys.queueStatus,
    getDigitalHumanQueueStatus,
  )
  const canViewSystemResources = hasPermission(7)
  // 用户统计仅 sadmin 可见；非 sadmin 不发请求（enabled=false 时 isLoading 为 false）
  const { hasRole } = usePermission()
  const canViewUserStats = hasRole(ROLE.SADMIN)
  const { data: userStats, isLoading: isUserStatsLoading } = useQuery({
    queryKey: userQueryKeys.stats,
    queryFn: getUserStats,
    enabled: canViewUserStats,
  })

  const queueCards = [
    { key: 'video', icon: Clapperboard, title: '视频合成队列', query: videoQueue },
    // { key: 'voice', icon: Mic, title: '音色合成队列', query: voiceQueue },
    // { key: 'subtitle', icon: Subtitles, title: '字幕合成队列', query: subtitleQueue },
    {
      key: 'digital-human',
      icon: UserRound,
      title: '数字人合成队列',
      query: digitalHumanQueue,
    },
  ]

  if (isLoading) return <DashboardSkeleton />

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-6">
        <ErrorCard onRetry={() => void refetch()} />
      </div>
    )
  }

  const { latest, samples } = data

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {canViewUserStats && isUserStatsLoading && <UserStatsCardSkeleton />}
      {canViewUserStats && userStats && <UserStatsCard stats={userStats} />}

      {canViewSystemResources && <CpuCard cpu={latest.cpu} samples={samples} />}
      {canViewSystemResources && <MemoryCard memory={latest.memory} />}
      {canViewSystemResources && <DiskCard disk={latest.disk} />}
      {canViewSystemResources && <GpuCard gpu={latest.gpu} samples={samples} />}
      {canViewSystemResources && <ProcessCard process={latest.process} />}

      {queueCards.map((card) =>
        card.query.data ? (
          <QueueStatusCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            data={card.query.data}
          />
        ) : (
          <QueueStatusCardSkeleton key={card.key} />
        ),
      )}
    </div>
  )
}
