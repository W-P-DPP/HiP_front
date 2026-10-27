import { useMutation } from '@tanstack/react-query'
import { FolderCog, FolderInput, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

import {
  batchGroupVideoMaterials,
  deleteVideoMaterial,
  getMyVideoMaterials,
  updateVideoMaterial,
  videoMaterialQueryKeys,
} from '@/api/video-material'
import { AppDialog } from '@/components/AppDialog'
import { MaterialGrid } from '@/components/MaterialGrid'
import { MaterialSearchBar } from '@/components/MaterialSearchBar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useMaterialUpload } from '@/hooks/use-material-upload'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useVideoMaterialGroups } from '@/hooks/use-video-material-groups'
import type { VideoMaterial } from '@/types/video-material'
import { formatBytes } from '@/utils/format'
import { MAX_MATERIAL_SIZE, isSupportedMaterialFile } from '@/utils/material'
import { message } from '@/utils/message'

import { MaterialGroupDialog } from './MaterialGroupDialog'

/** 分组筛选「全部」哨兵值（Select 不接受空串 value） */
const GROUP_FILTER_ALL = '全部分组'

/** 上传/编辑弹框「不分组」哨兵值 */
const GROUP_NONE = '不分组'

/**
 * 分组 Select 的展示文案：Base UI 的 SelectValue 默认渲染原始 value（即分组 id），
 * 需自行映射回名称；哨兵值与空值回落到占位文案，已删除的分组回落到原值。
 */
function resolveGroupLabel(
  value: unknown,
  groupNameById: ReadonlyMap<string, string>,
  fallback: string,
): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value === GROUP_FILTER_ALL ||
    value === GROUP_NONE
  ) {
    return fallback
  }
  return groupNameById.get(value) ?? value
}

/** tab1 我的素材：分组筛选 + 列表 + 上传素材弹框；查询放在本组件内，切换 tab 卸载重挂会重新取数 */
export function MyMaterialsTab() {
  // 搜索应用态（触发搜索后才更新）+ 搜索版本计数：即使条件未变化也强制重新请求
  const [keyword, setKeyword] = useState('')
  const [fileName, setFileName] = useState('')
  // 分组筛选（'' = 全部）
  const [groupId, setGroupId] = useState('')
  const [searchVersion, setSearchVersion] = useState(0)

  const { groups, isLoading: isGroupsLoading } = useVideoMaterialGroups()
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group._id, group.name])),
    [groups],
  )
  // 当前筛选分组已不存在（如被删除）时回落为「全部」；用派生值避免在 effect 中 setState
  const activeGroupId =
    groupId && (isGroupsLoading || groups.some((group) => group._id === groupId))
      ? groupId
      : ''

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
    queryKey: [...videoMaterialQueryKeys.my, keyword, fileName, activeGroupId, searchVersion],
    // 后端分页参数名是 limit，映射自 pageSize；无条件的项不传
    queryFn: ({ page, pageSize }) =>
      getMyVideoMaterials({
        page,
        limit: pageSize,
        ...(keyword ? { keyword } : {}),
        ...(fileName ? { fileName } : {}),
        ...(activeGroupId ? { groupId: activeGroupId } : {}),
      }),
  })

  const [groupOpen, setGroupOpen] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadKeyword, setUploadKeyword] = useState('')
  const [uploadGroupId, setUploadGroupId] = useState('')
  const { upload, progress, isUploading, isChunked, cancel } = useMaterialUpload()
  const deleteMutation = useMutation({ mutationFn: deleteVideoMaterial })

  // 编辑弹框：可修改关键词与所属分组
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editKeyword, setEditKeyword] = useState('')
  const [editGroupId, setEditGroupId] = useState('')
  const editMutation = useMutation({ mutationFn: updateVideoMaterial })

  // 多选 + 批量分组：选择跨页保留，成功后清空并刷新
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchGroupId, setBatchGroupId] = useState('')
  const batchGroupMutation = useMutation({ mutationFn: batchGroupVideoMaterials })

  const pageIds = useMemo(() => data.map((item) => item._id), [data])
  const selectedOnPageCount = pageIds.filter((id) => selectedIds.has(id)).length
  const isAllPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length
  const isPagePartiallySelected = selectedOnPageCount > 0 && !isAllPageSelected

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
    setGroupId('')
    setPage(1)
    setSearchVersion((version) => version + 1)
  }, [setPage])

  const handleGroupChange = useCallback(
    (value: string) => {
      setGroupId(value === GROUP_FILTER_ALL ? '' : value)
      setPage(1)
    },
    [setPage],
  )

  // 删除后重新取数；失败提示由拦截器统一处理，catch 留空避免未处理拒绝
  const handleDelete = useCallback(
    async (item: VideoMaterial) => {
      try {
        await deleteMutation.mutateAsync(item._id)
        refetch()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [deleteMutation, refetch],
  )

  const handleOpenEdit = useCallback((item: VideoMaterial) => {
    setEditId(item._id)
    setEditKeyword(item.keyword)
    setEditGroupId(item.groupId ?? '')
    setEditOpen(true)
  }, [])

  const handleEdit = useCallback(async () => {
    const keyword = editKeyword.trim()
    if (!keyword || !editId) return
    try {
      // 始终回传分组：空串表示移出分组（后端约定）
      await editMutation.mutateAsync({ id: editId, keyword, groupId: editGroupId })
      setEditOpen(false)
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [editKeyword, editId, editGroupId, editMutation, refetch])

  const handleEditKeywordKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && editKeyword.trim() && !editMutation.isPending) {
        void handleEdit()
      }
    },
    [editKeyword, editMutation.isPending, handleEdit],
  )

  const toggleSelect = useCallback((item: VideoMaterial) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item._id)) next.delete(item._id)
      else next.add(item._id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // 全选/取消全选当前页（保留其他页已选项）
  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }, [pageIds])

  const handleOpenBatch = useCallback(() => {
    setBatchGroupId('')
    setBatchOpen(true)
  }, [])

  const handleBatchGroup = useCallback(async () => {
    if (selectedIds.size === 0) return
    try {
      // 空串表示移出分组（后端约定）；成功提示由后端 msg 统一弹出
      await batchGroupMutation.mutateAsync({
        ids: Array.from(selectedIds),
        groupId: batchGroupId,
      })
      setBatchOpen(false)
      clearSelection()
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [selectedIds, batchGroupId, batchGroupMutation, clearSelection, refetch])

  // 选择文件后校验类型（仅图片/视频），通过则自动以「文件名去扩展名」填关键词；
  // 清空 input.value 允许重复选择同一文件
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    if (!isSupportedMaterialFile(file)) {
      message.error('仅支持上传图片或视频素材')
      return
    }
    if (file.size > MAX_MATERIAL_SIZE) {
      message.error('素材大小不能超过 2.5GB')
      return
    }
    setUploadFile(file)
    setUploadKeyword(file.name.replace(/\.[^.]+$/, ''))
  }, [])

  const resetUploadForm = useCallback(() => {
    setUploadFile(null)
    setUploadKeyword('')
    setUploadGroupId('')
  }, [])

  const handleUpload = useCallback(async () => {
    if (!uploadFile || !uploadKeyword.trim()) return
    try {
      await upload({
        file: uploadFile,
        keyword: uploadKeyword.trim(),
        fileName: uploadFile.name,
        ...(uploadGroupId ? { groupId: uploadGroupId } : {}),
      })
      setUploadOpen(false)
      resetUploadForm()
      refetch()
    } catch {
      // 失败提示已统一处理：分片流程在 hook 内提示，整份直传由 axios 拦截器提示
    }
  }, [uploadFile, uploadKeyword, uploadGroupId, upload, refetch, resetUploadForm])

  const handleUploadKeywordKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key === 'Enter' &&
        uploadFile &&
        uploadKeyword.trim() &&
        !isUploading
      ) {
        void handleUpload()
      }
    },
    [uploadFile, uploadKeyword, isUploading, handleUpload],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <MaterialSearchBar onSearch={handleSearch} onReset={handleReset} />
        <Select
          value={activeGroupId || GROUP_FILTER_ALL}
          onValueChange={(value) =>
            handleGroupChange(typeof value === 'string' ? value : '')
          }
        >
          <SelectTrigger className="w-40" aria-label="按分组筛选">
            <SelectValue>
              {(value) => resolveGroupLabel(value, groupNameById, GROUP_FILTER_ALL)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GROUP_FILTER_ALL}>全部分组</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group._id} value={group._id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          data-icon="inline-start"
          onClick={() => setGroupOpen(true)}
        >
          <FolderCog />
          管理分组
        </Button>
        <Button
          data-icon="inline-start"
          className="ml-auto"
          onClick={() => setUploadOpen(true)}
        >
          <Plus />
          上传素材
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all-page"
            checked={isAllPageSelected}
            indeterminate={isPagePartiallySelected}
            disabled={pageIds.length === 0}
            onCheckedChange={handleToggleSelectAll}
            aria-label="全选本页"
          />
          <Label
            htmlFor="select-all-page"
            className="cursor-pointer font-normal text-muted-foreground"
          >
            全选本页
          </Label>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">已选 {selectedIds.size} 个</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            data-icon="inline-start"
            disabled={selectedIds.size === 0}
            onClick={handleOpenBatch}
          >
            <FolderInput />
            批量分组
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={clearSelection}
          >
            取消选择
          </Button>
        </div>
      </div>

      <MaterialGrid
        data={data}
        loading={isLoading}
        fetching={isFetching}
        error={isError ? error : null}
        onRetry={refetch}
        groupNames={groupNameById}
        selection={{ selectedKeys: selectedIds, onToggleRow: toggleSelect }}
        emptyTitle="暂无素材"
        emptyDescription="上传素材后用于内容制作。"
        pagination={{
          page,
          pageSize,
          total,
          pageSizeOptions,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      <AppDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) {
            // 上传中关闭弹框＝取消上传（中止请求并清理分片会话）
            if (isUploading) cancel()
            resetUploadForm()
          }
        }}
        title="上传素材"
        description="选择一个素材文件并填写关键词。"
        confirmText="上传"
        cancelText={isUploading ? '取消上传' : '取消'}
        confirmLoading={isUploading}
        confirmDisabled={!uploadFile || !uploadKeyword.trim()}
        onConfirm={() => void handleUpload()}
      >
        <div className="flex flex-col gap-4 px-2.5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-file">素材文件</Label>
            <Input
              id="material-file"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
            {uploadFile ? (
              <p className="text-xs text-muted-foreground">
                {uploadFile.name} · {formatBytes(uploadFile.size)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">仅支持图片、视频格式。</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-keyword">关键词</Label>
            <Input
              id="material-keyword"
              value={uploadKeyword}
              onChange={(event) => setUploadKeyword(event.target.value)}
              onKeyDown={handleUploadKeywordKeyDown}
              placeholder="默认为文件名（去扩展名）"
            />
            <p className="text-xs text-muted-foreground">用于检索素材。</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-group">分组（可选）</Label>
            <Select
              value={uploadGroupId || GROUP_NONE}
              onValueChange={(value) =>
                setUploadGroupId(
                  typeof value === 'string' && value !== GROUP_NONE ? value : '',
                )
              }
            >
              <SelectTrigger id="material-group" className="w-full">
                <SelectValue>
                  {(value) => resolveGroupLabel(value, groupNameById, GROUP_NONE)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GROUP_NONE}>不分组</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isChunked ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>上传中</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <Progress value={Math.round(progress * 100)} />
            </div>
          ) : null}
        </div>
      </AppDialog>

      <AppDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditKeyword('')
            setEditGroupId('')
          }
        }}
        title="编辑素材"
        description="修改素材关键词与所属分组。"
        confirmText="保存"
        confirmLoading={editMutation.isPending}
        confirmDisabled={!editKeyword.trim()}
        onConfirm={() => void handleEdit()}
      >
        <div className="flex flex-col gap-4 px-2.5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-keyword">关键词</Label>
            <Input
              id="edit-keyword"
              value={editKeyword}
              onChange={(event) => setEditKeyword(event.target.value)}
              onKeyDown={handleEditKeywordKeyDown}
              placeholder="请输入关键词"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">用于检索素材。</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-group">分组（可选）</Label>
            <Select
              value={editGroupId || GROUP_NONE}
              onValueChange={(value) =>
                setEditGroupId(
                  typeof value === 'string' && value !== GROUP_NONE ? value : '',
                )
              }
            >
              <SelectTrigger id="edit-group" className="w-full">
                <SelectValue>
                  {(value) => resolveGroupLabel(value, groupNameById, GROUP_NONE)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GROUP_NONE}>不分组</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">留空表示移出分组。</p>
          </div>
        </div>
      </AppDialog>

      <AppDialog
        open={batchOpen}
        onOpenChange={(open) => {
          setBatchOpen(open)
          if (!open) setBatchGroupId('')
        }}
        title="批量分组"
        description={`将选中的 ${selectedIds.size} 个素材归入同一分组。`}
        confirmText="确定"
        confirmLoading={batchGroupMutation.isPending}
        onConfirm={() => void handleBatchGroup()}
      >
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Label htmlFor="batch-group">目标分组</Label>
          <Select
            value={batchGroupId || GROUP_NONE}
            onValueChange={(value) =>
              setBatchGroupId(
                typeof value === 'string' && value !== GROUP_NONE ? value : '',
              )
            }
          >
            <SelectTrigger id="batch-group" className="w-full">
              <SelectValue>
                {(value) => resolveGroupLabel(value, groupNameById, GROUP_NONE)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GROUP_NONE}>不分组（移出分组）</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group._id} value={group._id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            选择「不分组」将所选素材移出当前分组。
          </p>
        </div>
      </AppDialog>

      <MaterialGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />
    </div>
  )
}
