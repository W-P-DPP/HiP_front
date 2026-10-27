# HiP

HiP 是一个中文 AI 媒体生产管理后台（SPA），围绕「声音 → 视频」的 AI 内容生产流程，提供音色克隆、数字人视频、字幕合成、短视频工厂、AI 场景解说等能力，并配套素材库、多租户用户管理与数据统计。

## 功能清单

- **音色克隆（TTS）**：上传不少于 10s 的音频样本建立音色，支持试听合成与正式语音合成。
- **数字人视频**：以视频（≥5s）创建数字人形象，选定形象 + 音色 + 字幕后合成口播视频。
- **字幕合成**：对音视频做 ASR 识别，生成并导出 SRT 字幕。
- **短视频工厂**：脚本 → 配音 → 字幕 → 关键词匹配视频片段 → 成片的流水线式合成。
- **AI 场景解说**：场景切分 → 抽帧 → 逐场景转写 → 画面识别（VLM）→ 视频理解（LLM）→ 生成解说文案 → 解说视频合成。
- **AI 对话**：基于用户自建 AI 平台配置的多轮对话，支持 SSE 流式输出与打字机效果。
- **素材库**：图片 / 视频素材的网格管理、分组、关键词检索，大文件分片上传。
- **用户与权限**：多级多租户账号体系（`sadmin` / `admin` / `user`），API 密钥管理、个人资料、AI 平台 / 微信 / 抖音配置。
- **数据统计**：公众号文章数据统计，仪表盘展示服务器 CPU / 内存 / 磁盘 / GPU 资源与任务队列趋势。

## 技术栈

- **构建**：Vite 8 + React 19 + TypeScript 6
- **UI**：Tailwind CSS v4（无 config，主题走 `src/index.css` 的 CSS 变量）+ shadcn/ui（**Base UI** 底层，`base-nova` 预设）+ lucide-react
- **状态**：TanStack Query（服务端状态）+ Zustand（客户端状态）
- **请求 / 路由**：Axios（基于 cookie 鉴权）+ React Router v7（hash 路由）
- **图表 / 提示**：Recharts + sonner
- **包管理**：pnpm

## 目录结构

```
src/
  api/         按领域拆分的 axios 请求模块（auth、user、voice-train-v2、digital-human …）
  assets/      静态资源
  components/  通用组件（AppDialog / ConfirmPopover / DataTable / MaterialGrid …）
    ui/        shadcn 组件（自动生成，勿手改）
  constant/    常量（导航 nav、轮询 poll、RSA 公钥、各向导步骤定义）
  hooks/       自定义 hooks（分页查询、系统资源轮询、任务步骤、SSE 聊天 …）
  layouts/     布局（AdminLayout / AppSidebar / SiteHeader）
  lib/         基础工具（cn()）
  pages/       路由页面（按业务域分子目录）
  routes/      路由表与 RequireAuth 守卫
  store/       Zustand store（user）
  types/       TypeScript 类型定义
  utils/       业务工具（axios、message、auth、media、srt、sse …）
```

路由地址集中在 `src/routes/router.tsx`：公开的 `/login`，其余在 `RequireAuth` 守卫下的 `AdminLayout` 中，例如 `/dashboard`、`/users`、`/voice-training-v2`、`/materials`、`/digital-human`、`/work-room/*`、`/account/*`、`/data-analyze` 等。

## 快速开始

```bash
pnpm install

pnpm dev      # 启动开发服务器（vite --host）
pnpm build    # 类型检查并构建，产物输出到 front/
pnpm preview  # 预览构建产物
pnpm lint     # ESLint
```

## 环境变量

按环境分别写在 `.env.development` / `.env.production`（变量类型声明见 `src/vite-env.d.ts`）：

| 变量 | 用途 |
| --- | --- |
| `VITE_ENV` | 环境标识，决定应用的 base 路径（开发 `/dev/hip`，生产 `/hip`） |
| `VITE_API_BASE_URL` | 后端地址；开发为本地后端，生产留空走同源 |
| `VITE_API_BASE_KEY` | base 之下的 API 路径前缀，如 `/hip/api` |
| `VITE_COOKIES` | 仅开发用，预置登录 cookie 便于本地调试（敏感值，勿提交） |

开发环境下由 `vite.config.ts` 的 `server.proxy` 将 API 前缀、`${base}/wx`（微信业务）、`${base}/auth`（登录注册）分别转发到 `VITE_API_BASE_URL`，浏览器保持同源以携带 cookie。

## 构建与部署

- `pnpm build` 先跑 `tsc -b` 类型检查，再执行 `vite build`，产物输出到 `front/` 目录。
- 生产 base 路径为 `/hip`，需将 `front/` 部署到该路径下；`VITE_API_BASE_URL` 留空，接口走后端同源。
- `pnpm build:dev` 以 development 模式构建。

## 开发约定

- **状态分层**：与后端同步的数据用 TanStack Query（`staleTime: 0`、`retry: false`），UI 本地状态用 Zustand。
- **请求提示统一**：所有成功 / 失败消息由 `src/utils/axios.ts` 拦截器统一处理（写操作成功 + 所有失败提示，GET 成功静默）；轮询等静默请求传 `{ silent: true }`。
- **交互组件统一**：删除必须走 `ConfirmPopover` 二次确认，新增 / 编辑弹框统一用 `AppDialog`。
- **长任务轮询**：后端排队调度，前端两阶段轮询（队列位置 → 任务状态）至终态后停止。
- **UI 规范**：shadcn 组件固定在 `@/components/ui/*`，不手改生成文件；只用语义化颜色令牌（`bg-primary`、`text-muted-foreground` 等），间距用 `gap-*`，条件类名用 `cn()`。
- **代码规范**：遵循阿里前端规约（组件 PascalCase、非组件文件 kebab-case、单引号、2 空格缩进、`===`、不用 `any` 等）；提交信息用 `type(scope): subject`。
- **新增 shadcn 组件**：使用 `pnpm dlx shadcn@4.18.0 add <name>`（不固定版本会崩溃），添加后通读生成文件再接入业务。
