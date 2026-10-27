import { useCallback, useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { PageParams, PageResult } from '@/types/api'

/** 每页条数可选项默认值 */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export interface UsePaginationQueryOptions<TData, TResult = PageResult<TData>> {
  /** 查询键前缀，内部会追加 { page, pageSize } 分页参数 */
  queryKey: readonly unknown[]
  /** 分页查询函数，接收分页参数并返回后端原始响应 */
  queryFn: (params: PageParams) => Promise<TResult>
  /** 把原始响应归一化成 PageResult<TData>，默认取 { list, total } */
  select?: (data: TResult) => PageResult<TData>
  /** 初始页码，默认 1 */
  initialPage?: number
  /** 初始每页条数，默认 10 */
  initialPageSize?: number
  /** 每页条数可选项，默认 [10, 20, 50, 100] */
  pageSizeOptions?: readonly number[]
  /** 是否启用查询，默认 true */
  enabled?: boolean
  /** 轮询间隔（毫秒），false 表示不轮询；组件卸载（无 observer）时由 react-query 自动清除定时器 */
  refetchInterval?: number | false
}

export interface UsePaginationQueryResult<TData> {
  /** 当前页数据 */
  data: TData[]
  /** 总条数 */
  total: number
  /** 当前页码（从 1 开始） */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 每页条数可选项 */
  pageSizeOptions: readonly number[]
  /** 总页数（至少为 1） */
  totalPages: number
  /** 首次加载中 */
  isLoading: boolean
  /** 任意一次请求中（含翻页/刷新） */
  isFetching: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  /** 跳转页码（自动钳制到 >= 1） */
  setPage: (page: number) => void
  /** 修改每页条数（自动回到第 1 页） */
  setPageSize: (pageSize: number) => void
}

export function usePaginationQuery<TData, TResult = PageResult<TData>>({
  queryKey,
  queryFn,
  select,
  initialPage = 1,
  initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  enabled = true,
  refetchInterval = false,
}: UsePaginationQueryOptions<TData, TResult>): UsePaginationQueryResult<TData> {
  const [page, setPageState] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const query = useQuery({
    queryKey: [...queryKey, { page, pageSize }],
    queryFn: () => queryFn({ page, pageSize }),
    // 翻页时保留上一页数据，避免骨架闪烁
    placeholderData: keepPreviousData,
    select: select ?? ((data) => data as PageResult<TData>),
    enabled,
    refetchInterval,
  })

  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])

  const setPageSize = useCallback((next: number) => {
    setPageSizeState(next)
    setPageState(1)
  }, [])

  // 数据收缩（如删除最后一页最后一条）后当前页可能越界，等请求落定后自动回落到合法页码
  useEffect(() => {
    if (!query.isFetching && page > 1 && page > totalPages) {
      setPageState(totalPages)
    }
  }, [page, totalPages, query.isFetching])

  return {
    data: query.data?.list ?? [],
    total,
    page,
    pageSize,
    pageSizeOptions,
    totalPages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    setPage,
    setPageSize,
  }
}
