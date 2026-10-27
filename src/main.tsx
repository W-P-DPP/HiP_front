import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { router } from '@/routes/router'
import './index.css'

const queryClient = new QueryClient({
  // 不缓存：staleTime=0 数据始终视为过期，每次进入页面/切回 tab/窗口聚焦都会重新取数
  // 失败不自动重试：由页面内 ErrorCard 的“重试”按钮手动触发 refetch
  defaultOptions: { queries: { staleTime: 0, retry: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
