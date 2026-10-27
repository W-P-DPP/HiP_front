import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { WxArticleStatItem } from '@/types/wechat-summary'
import {
  aggregateDailyFromRows,
  aggregateSources,
  formatCount,
  formatDuration,
  formatMoney,
  formatRate,
  latestJumpPositions,
  sortDayStats,
  sumArticle,
} from '@/utils/wechat-summary'

import { ReadPositionChart, ReadTrendChart, SourceRankChart } from './WechatCharts'

const PUBLISH_TYPE_LABEL: Record<number, string> = { 1: '群发' }

interface WechatArticleDetailProps {
  article: WxArticleStatItem
}

/** 单篇详情：区间合计 + 每日阅读趋势 + 来源/位置图 + 每日明细表 */
export function WechatArticleDetail({ article }: WechatArticleDetailProps) {
  const rows = useMemo(() => sortDayStats(article.detail_list), [article])
  const totals = useMemo(() => sumArticle(article), [article])
  const daily = useMemo(() => aggregateDailyFromRows(rows), [rows])
  const sources = useMemo(() => aggregateSources(rows), [rows])
  const jumpPositions = useMemo(() => latestJumpPositions(rows), [rows])
  const publishLabel = PUBLISH_TYPE_LABEL[article.publish_type]

  const summaries = [
    { label: '阅读人数', value: formatCount(totals.read) },
    { label: '分享', value: formatCount(totals.share) },
    { label: '在看', value: formatCount(totals.zaikan) },
    { label: '点赞', value: formatCount(totals.like) },
    { label: '收藏', value: formatCount(totals.collection) },
    { label: '评论', value: formatCount(totals.comment) },
  ]

  return (
    <Card className="rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg leading-snug">{article.title}</CardTitle>
            {article.content_url ? (
              <a
                href={article.content_url}
                target="_blank"
                rel="noreferrer"
                aria-label="在新窗口打开原文"
                className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>发布于 {article.ref_date}</span>
            {publishLabel ? <Badge variant="secondary">{publishLabel}</Badge> : null}
            <span>{rows.length > 0 ? `区间内有 ${rows.length} 天明细` : '区间内暂无明细'}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {summaries.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              <span className="text-lg font-medium tabular-nums tracking-tight">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-medium">每日阅读趋势</h3>
          <ReadTrendChart data={daily} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="font-medium">阅读来源分布</h3>
            {sources.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                暂无有阅读量的来源数据
              </p>
            ) : (
              <div className="max-w-xl">
                <SourceRankChart sources={sources} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="font-medium">阅读位置分布</h3>
            {jumpPositions && jumpPositions.length > 0 ? (
              <ReadPositionChart positions={jumpPositions} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                该区间未返回阅读位置数据
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-medium">每日明细</h3>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">日期</TableHead>
                  <TableHead className="text-right">阅读人数</TableHead>
                  <TableHead className="text-right">分享</TableHead>
                  <TableHead className="text-right">在看</TableHead>
                  <TableHead className="text-right">点赞</TableHead>
                  <TableHead className="text-right">收藏</TableHead>
                  <TableHead className="text-right">评论</TableHead>
                  <TableHead className="text-right">阅读率</TableHead>
                  <TableHead className="text-right">读完率</TableHead>
                  <TableHead className="text-right">平均时长</TableHead>
                  <TableHead className="text-right">赞赏(元)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.stat_date}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.stat_date}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.read_user)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.share_user)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.zaikan_user)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.like_user)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.collection_user)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.comment_count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRate(row.read_delivery_rate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRate(row.read_finish_rate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.read_avg_activetime)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.praise_money)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
