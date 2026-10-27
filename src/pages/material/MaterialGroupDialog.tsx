import { useMutation } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  createVideoMaterialGroup,
  deleteVideoMaterialGroup,
  renameVideoMaterialGroup,
} from '@/api/video-material'
import { AppDialog } from '@/components/AppDialog'
import { ConfirmPopover } from '@/components/ConfirmPopover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useVideoMaterialGroups } from '@/hooks/use-video-material-groups'
import type { VideoMaterialGroup } from '@/types/video-material'

/** 首屏骨架行数 */
const SKELETON_ROWS = 3

export interface MaterialGroupDialogProps {
  /** 受控开关 */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 素材分组管理弹框：顶部新增分组，列表内提供行内重命名与删除（二次确认）。
 * 写操作的成败提示由 axios 拦截器统一处理，此处仅负责提交与刷新列表。
 */
export function MaterialGroupDialog({ open, onOpenChange }: MaterialGroupDialogProps) {
  const { groups, isLoading, refetch } = useVideoMaterialGroups()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')

  const createMutation = useMutation({ mutationFn: createVideoMaterialGroup })
  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameVideoMaterialGroup(id, name),
  })
  const deleteMutation = useMutation({ mutationFn: deleteVideoMaterialGroup })

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name || createMutation.isPending) return
    try {
      await createMutation.mutateAsync(name)
      setNewName('')
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [newName, createMutation, refetch])

  const handleCreateKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') void handleCreate()
    },
    [handleCreate],
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setNewName('')
        setEditingId('')
        setEditingName('')
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const handleStartEdit = useCallback((group: VideoMaterialGroup) => {
    setEditingId(group._id)
    setEditingName(group.name)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId('')
    setEditingName('')
  }, [])

  const handleRename = useCallback(async () => {
    const name = editingName.trim()
    if (!name || !editingId || renameMutation.isPending) return
    try {
      await renameMutation.mutateAsync({ id: editingId, name })
      handleCancelEdit()
      refetch()
    } catch {
      // 失败提示已由 axios 拦截器统一处理
    }
  }, [editingName, editingId, renameMutation, refetch, handleCancelEdit])

  const handleRenameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') void handleRename()
      if (event.key === 'Escape') handleCancelEdit()
    },
    [handleRename, handleCancelEdit],
  )

  const handleDelete = useCallback(
    async (group: VideoMaterialGroup) => {
      try {
        await deleteMutation.mutateAsync(group._id)
        refetch()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [deleteMutation, refetch],
  )

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="管理分组"
      description="新增、重命名或删除素材分组。"
      confirmText="完成"
      hideCancel
      onConfirm={() => onOpenChange(false)}
    >
      <div className="flex flex-col gap-4 px-2.5 py-1">
        <div className="flex items-center gap-2">
          <Input
            aria-label="新分组名称"
            placeholder="输入新分组名称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={handleCreateKeyDown}
          />
          <Button
            data-icon="inline-start"
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || createMutation.isPending}
          >
            <Plus />
            新增
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl bg-muted py-8">
              <span className="text-sm font-medium text-foreground">暂无分组</span>
              <span className="text-xs text-muted-foreground">
                在上方输入名称创建第一个分组。
              </span>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group._id}
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
              >
                {editingId === group._id ? (
                  <>
                    <Input
                      aria-label="分组名称"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleRename()}
                      disabled={!editingName.trim() || renameMutation.isPending}
                    >
                      保存
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm text-foreground">
                      {group.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="重命名分组"
                      onClick={() => handleStartEdit(group)}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmPopover
                      title="删除分组"
                      description={`确定删除分组「${group.name}」？`}
                      confirmText="删除"
                      confirmLoading={deleteMutation.isPending}
                      onConfirm={() => handleDelete(group)}
                    >
                      <Trash2 />
                    </ConfirmPopover>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppDialog>
  )
}
