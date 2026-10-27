import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Inbox, RotateCw } from 'lucide-react'

import { getUserChildrenList, userQueryKeys } from '@/api/user'
import { UserCascader } from '@/components/UserCascader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useWechatArticleStats } from '@/hooks/use-wechat-summary'
import type { WxArticleStatItem, WxStatRange } from '@/types/wechat-summary'
import type { UserTreeNode } from '@/types/user'
import { formatCount } from '@/utils/wechat-summary'

import { WechatArticleDetail } from './WechatArticleDetail'
import { WechatOverview } from './WechatOverview'
import { MAX_RANGE_DAYS, presetRange, spanDays } from './wechat-range'

const PRESETS = [
  { label: '近三天', days: 3 },
  { label: '近一周', days: 7 },
  { label: '近一月', days: 30 },
] as const

interface WechatStatTabProps {
  range: WxStatRange
  /** 点快捷区间时触发（父级负责落 range） */
  onPreset: (days: number) => void
  /** 自定义区间点「查询」时触发 */
  onApplyRange: (range: WxStatRange) => void
}

interface DateRangeToolbarProps extends WechatStatTabProps {
  /** 用户级联数据：当前账号下的用户树根节点（/users/children data.list） */
  userRoots: readonly UserTreeNode[]
  /** 用户树拉取中（触发器禁用） */
  usersLoading: boolean
  /** 当前选中用户 id（空串 = 不按用户过滤） */
  selectedUserId: string
  /** 选中某个用户（含重新选默认第一个之外的账号） */
  onSelectUser: (userId: string) => void
}

/** 公众号 tab 内容：查询在此组件内，切走卸载、切回重挂即重新取数 */
export function WechatStatTab({ range, onPreset, onApplyRange }: WechatStatTabProps) {
  // 当前账号下的用户树（供搜索区选「查谁的公众号」）；查询放 tab 内容内，进入/切回重挂即重取
  const { data: userTree, isLoading: usersLoading } = useQuery({
    queryKey: userQueryKeys.children,
    queryFn: getUserChildrenList,
  })
  const roots = userTree?.list ?? []

  // 选中用户：每次重挂回到默认第一个用户；手动下拉选择后以手动值为准
  const [userOverride, setUserOverride] = useState<string | null>(null)
  const selectedUserId = userOverride ?? roots[0]?.id ?? ''

  const { data, isLoading, isError, refetch } = useWechatArticleStats(
    range.beginDate,
    range.endDate,
    selectedUserId || undefined,
    !usersLoading, // 用户树未就绪前禁用，避免先用缺省 userId 发一次请求
  )
  const articles = data?.list ?? []
  const [selectedMsgid, setSelectedMsgid] = useState<string | null>(null)
  const selected =
    articles.find((article) => article.msgid === selectedMsgid) ?? articles[0] ?? null

  // 用户树解析中也按骨架展示，避免被误判为加载失败
  const resolving = usersLoading || isLoading

  return (
    <div className="flex flex-col gap-6">
      <DateRangeToolbar
        key={`${range.beginDate}-${range.endDate}`}
        range={range}
        onPreset={onPreset}
        onApplyRange={onApplyRange}
        userRoots={roots}
        usersLoading={usersLoading}
        selectedUserId={selectedUserId}
        onSelectUser={setUserOverride}
      />

      {data?.failedDays?.length ? (
        <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-muted-foreground">
          <CalendarRange className="size-4 shrink-0" />
          <span>
            部分日期数据抓取失败（{data.failedDays.length} 天），当前展示为成功日期的结果。
          </span>
        </div>
      ) : null}

      {resolving ? (
        <WechatStatSkeleton />
      ) : isError || !data ? (
        <StatErrorCard onRetry={() => void refetch()} />
      ) : articles.length === 0 ? (
        <StatEmptyCard />
      ) : (
        <>
          <WechatOverview
            articles={articles}
            beginDate={range.beginDate}
            endDate={range.endDate}
          />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(15rem,22rem)_1fr]">
            <ArticleList
              articles={articles}
              selectedMsgid={selected?.msgid ?? null}
              onSelect={setSelectedMsgid}
            />
            {selected ? <WechatArticleDetail article={selected} /> : null}
          </div>
        </>
      )}
    </div>
  )
}

/** 日期控件：快捷区间 + 自定义起止（本地草稿，点查询提交） */
function DateRangeToolbar({
  range,
  onPreset,
  onApplyRange,
  userRoots,
  usersLoading,
  selectedUserId,
  onSelectUser,
}: DateRangeToolbarProps) {
  const [draft, setDraft] = useState({ begin: range.beginDate, end: range.endDate })

  const span = draft.begin && draft.end ? spanDays(draft.begin, draft.end) : 0
  const valid = Boolean(draft.begin && draft.end) && draft.begin <= draft.end && span <= MAX_RANGE_DAYS

  const hint = !draft.begin || !draft.end
    ? '请选择起止日期'
    : draft.begin > draft.end
      ? '开始日期不能晚于结束日期'
      : span > MAX_RANGE_DAYS
        ? `单次查询最多 ${MAX_RANGE_DAYS} 天`
        : null

  const handlePreset = (days: number) => {
    const next = presetRange(days)
    setDraft({ begin: next.beginDate, end: next.endDate })
    onPreset(days)
  }

  const handleApply = () => {
    if (!valid || !draft.begin || !draft.end) return
    onApplyRange({ beginDate: draft.begin, endDate: draft.end })
  }

  return (
    <div className="flex flex-col gap-3 xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>快捷区间</Label>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {PRESETS.map((preset) => {
              const presetRangeValue = presetRange(preset.days)
              const active =
                presetRangeValue.beginDate === range.beginDate &&
                presetRangeValue.endDate === range.endDate
              return (
                <Button
                  key={preset.days}
                  size="sm"
                  variant={active ? 'default' : 'ghost'}
                  className="h-8 px-3"
                  onClick={() => handlePreset(preset.days)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stat-begin">开始日期</Label>
          <Input
            id="stat-begin"
            type="date"
            value={draft.begin}
            onChange={(event) => setDraft((prev) => ({ ...prev, begin: event.target.value }))}
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stat-end">结束日期</Label>
          <Input
            id="stat-end"
            type="date"
            value={draft.end}
            onChange={(event) => setDraft((prev) => ({ ...prev, end: event.target.value }))}
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>用户</Label>
          <UserCascader
            roots={userRoots}
            value={selectedUserId || null}
            loading={usersLoading}
            onValueChange={onSelectUser}
            className="w-44"
          />
        </div>

        <Button variant="outline" disabled={!valid} onClick={handleApply}>
          查询
        </Button>
      </div>
      {hint ? <p className="text-xs text-destructive">{hint}</p> : null}
    </div>
  )
}

/** 左侧文章列表：标题 + 发布日期 + 区间阅读；点选切换右侧详情 */
function ArticleList({
  articles,
  selectedMsgid,
  onSelect,
}: {
  articles: WxArticleStatItem[]
  selectedMsgid: string | null
  onSelect: (msgid: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="px-1 text-sm font-medium text-muted-foreground">
        发表内容 · {formatCount(articles.length)} 篇
      </h3>
      <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto xl border bg-card p-1.5">
        {articles.map((article) => {
          const readCount = article.detail_list.reduce(
            (sum, row) => sum + row.read_user,
            0,
          )
          const active = article.msgid === selectedMsgid
          return (
            <button
              key={article.msgid}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(article.msgid)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                active ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              <span className="line-clamp-2 text-sm font-medium leading-snug">
                {article.title}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                发布于 {article.ref_date} · 阅读 {formatCount(readCount)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex size-12 items-center justify-center xl bg-destructive/10">
          <Inbox className="size-5 text-destructive" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium text-destructive">公众号数据加载失败</p>
          <p className="text-sm text-muted-foreground">请确认微信配置与后端服务后重试。</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          重试
        </Button>
      </CardContent>
    </Card>
  )
}

function StatEmptyCard() {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex size-12 items-center justify-center xl bg-muted">
          <Inbox className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">该区间暂无发表内容数据</p>
          <p className="text-sm text-muted-foreground">试试切换更大的日期范围。</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WechatStatSkeleton() {
  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-56 w-full xl" />
        <Skeleton className="h-56 w-full xl" />
      </CardContent>
    </Card>
  )
}
