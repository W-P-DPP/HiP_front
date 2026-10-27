import { useCallback, useState } from 'react'

import { getPublicVideoMaterials, videoMaterialQueryKeys } from '@/api/video-material'
import { MaterialGrid } from '@/components/MaterialGrid'
import { MaterialSearchBar } from '@/components/MaterialSearchBar'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type { VideoMaterial } from '@/types/video-material'

/** tab2 公共素材：只读网格，无任何操作；查询放在本组件内，切换 tab 卸载重挂会重新取数 */
export function PublicMaterialsTab() {
  // 搜索应用态（触发搜索后才更新）+ 搜索版本计数：即使条件未变化也强制重新请求
  const [keyword, setKeyword] = useState('')
  const [fileName, setFileName] = useState('')
  const [searchVersion, setSearchVersion] = useState(0)

  const {
    data,
    total,
    page,
    pageSize,
    pageSizeOptions,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    setPage,
    setPageSize,
  } = usePaginationQuery<VideoMaterial>({
    queryKey: [...videoMaterialQueryKeys.public, keyword, fileName, searchVersion],
    // 后端分页参数名是 limit，映射自 pageSize；无搜索条件不传 keyword/fileName
    queryFn: ({ page, pageSize }) =>
      getPublicVideoMaterials({
        page,
        limit: pageSize,
        ...(keyword ? { keyword } : {}),
        ...(fileName ? { fileName } : {}),
      }),
  })

  const handleSearch = useCallback(
    (nextKeyword: string, nextFileName: string) => {
      setKeyword(nextKeyword)
      setFileName(nextFileName)
      setPage(1)
      // 计数自增使 queryKey 一定变化，无论条件是否变更都重新请求
      setSearchVersion((version) => version + 1)
    },
    [setPage],
  )

  const handleReset = useCallback(() => {
    setKeyword('')
    setFileName('')
    setPage(1)
    setSearchVersion((version) => version + 1)
  }, [setPage])

  return (
    <div className="flex flex-col gap-4">
      <MaterialSearchBar onSearch={handleSearch} onReset={handleReset} />
      <MaterialGrid
        data={data}
        loading={isLoading}
        fetching={isFetching}
        error={isError ? error : null}
        onRetry={refetch}
        emptyTitle="暂无公共素材"
        emptyDescription="公共素材由管理员维护，可供所有用户使用。"
        pagination={{
          page,
          pageSize,
          total,
          pageSizeOptions,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  )
}
