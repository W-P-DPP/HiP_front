---
name: hip-front
description: hip-front 前端项目专属开发规范。Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui（Base UI · Nova 预设）。在本项目开发 UI、添加/调试组件、写数据层、修复 bug 或代码审查时使用。覆盖技术栈、目录约定、shadcn 组件使用规则、设计规范（Stitch/Vibe Design 美学）、样式规范、代码规范（阿里 f2e-spec 风格）、数据层模式、常用命令与踩坑记录。
---

# hip-front 项目开发规范

## 项目概览

hip-front 是一个前端 SPA（`c:\Users\admin\Desktop\my\hip-front`），采用 **Vite + React 19 + TypeScript** 构建，UI 基于 **shadcn/ui**（Base UI 底层，Nova 预设）。服务器状态用 TanStack Query，客户端状态用 Zustand，请求用 Axios，路由用 React Router v7。

> **重要**：本项目 **base 是 Base UI（`@base-ui/react`）而非 Radix**。shadcn 组件底层 API 据此不同（如自定义触发器用 `render` prop 而非 `asChild`）。

## 技术栈（实际版本）

| 依赖 | 版本 |
|---|---|
| react / react-dom | ^19.2.8 |
| vite | ^8.2.2（插件 @vitejs/plugin-react） |
| typescript | ~6.0.2 |
| tailwindcss / @tailwindcss/vite | ^4.3.3（**Tailwind v4**，无 config 文件） |
| @base-ui/react | ^1.7.0（shadcn 底层库） |
| lucide-react | ^1.34.0（图标库） |
| react-router-dom | ^7.18.2 |
| @tanstack/react-query | ^5.102.3 |
| zustand | ^5.0.15 |
| axios | ^1.19.0 |
| shadcn (CLI) | ^4.19.0（**见踩坑记录，运行时固定用 4.18.0**） |

包管理器：**pnpm**（v10，项目有 `pnpm-lock.yaml`）。所有安装/CLI 命令用 `pnpm`。

## 常用命令

```bash
pnpm dev        # 启动 dev server（Vite，默认 5173）
pnpm build      # tsc -b && vite build
pnpm lint       # ESLint
pnpm preview    # 预览构建产物

# shadcn —— 必须固定 4.18.0 版本，不要用 latest（4.19.0 在此环境崩溃）
pnpm dlx shadcn@4.18.0 add button card dialog
pnpm dlx shadcn@4.18.0 add --all
pnpm dlx shadcn@4.18.0 info          # 查看组件配置与已装组件
pnpm dlx shadcn@4.18.0 docs button   # 获取组件文档 URL
```

## 目录结构与约定

```
src/
  api/         # axios 请求模块（按领域拆分，如 api/user.ts）
  assets/      # 静态资源
  components/  # 通用组件；shadcn 组件在 components/ui/ 下，不要手动改 ui/ 文件
  hooks/       # 自定义 hooks（useQuery 封装、业务 hooks）
  layouts/     # 布局组件（侧边栏、顶栏等）
  lib/         # 基础工具，src/lib/utils.ts 的 cn()
  pages/       # 路由页面组件
  routes/      # React Router v7 路由配置
  store/       # Zustand store（按领域拆分）
  types/       # TS 类型定义
  utils/       # 业务工具函数
```

- 路径别名：`@/*` → `src/*`（在 **根** `tsconfig.json` 和 `tsconfig.app.json` 中都配置了，vite.config.ts 中 `@` → `./src`）。
- shadcn 组件固定导入自 `@/components/ui/*`，工具函数导入自 `@/lib/utils` 的 `cn`。
- **不要添加 `baseUrl`** 到 tsconfig（TS 6.0 已弃用，会报 TS5101 并导致 `tsc -b` 失败）。`paths` 可独立使用。

## shadcn/ui 使用规范（本项目特定）

### CLI 用法
- 一律用 `pnpm dlx shadcn@4.18.0`（**不用 latest**，见踩坑记录）。
- 添加组件后**必须通读生成的文件**，检查缺失子组件/导入、组合是否合规、图标库是否匹配（本项目为 lucide）。
- 本项目的 `components.json`：style=`base-nova`、baseColor=`neutral`、iconLibrary=`lucide`、base=Base UI、font=Geist。

### 底层 API 差异（Base UI vs Radix）
- 自定义触发器用 **`render` prop**（Base UI），不是 `asChild`（Radix 专属）。不确定时先 `pnpm dlx shadcn@4.18.0 info` 查看 `base` 字段。
- 状态类组件（Select、ToggleGroup、Accordion 等）的受控方式遵循 Base UI 约定。

### 组件组合规则
- 条目放在所属 Group 内：`SelectItem`→`SelectGroup`、`DropdownMenuItem`→`DropdownMenuGroup`、`CommandItem`→`CommandGroup`。
- Dialog / Sheet / Drawer **必须有 Title**（`DialogTitle` 等），视觉隐藏用 `className="sr-only"`。
- 完整使用 Card 组合：`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`。
- `TabsTrigger` 必须放在 `TabsList` 内；`Avatar` 必须有 `AvatarFallback`。
- 表单用 `FieldGroup` + `Field`（本项目 nova/base 样式），绝不用 `div` + `space-y-*` 排表单。
- 按钮图标用 `data-icon="inline-start"` / `data-icon="inline-end"`，图标作为对象传入 `icon={CheckIcon}`。
- 选项集（2–7 个）用 `ToggleGroup`，不要循环 Button 手动管理激活态。

### 用组件而非自定义标记
- 提示信息 → `Alert`；空状态 → `Empty`；Toast → `sonner` 的 `toast()`；分隔 → `Separator`（不用 `<hr>`）；加载占位 → `Skeleton`（不用 `animate-pulse` div）；标签 → `Badge`（不用自定义 span）。

## UI 与样式规范

- **只用语义化颜色令牌**：`bg-background`、`text-muted-foreground`、`bg-primary` 等，绝不写 `bg-blue-500` 之类的原始值。
- **禁用手写 `dark:` 覆盖**，用 `.dark` 主题变量（shadcn 已配好）。
- 间距用 `flex` + `gap-*`（垂直 `flex flex-col gap-*`），**禁用 `space-x-*`/`space-y-*`**。
- 宽高相等用 `size-*`（`size-10` 而非 `w-10 h-10`）。
- 条件类名用 `cn()`，不要模板字符串手拼三元。
- `className` 只做布局，不覆盖组件颜色/排版；组件内部图标不加尺寸类。
- 叠加层组件（Dialog/Sheet/Popover）自己管 z-index，**不要手动设置 z-index**。

## 设计规范（Stitch / Vibe Design 风格）

本项目 UI 遵循 **Google Stitch**（Google Labs）的 **Vibe Design / taste-design** 美学：克制、高级、反"AI 味"（anti-generic）。现有 Nova 预设（neutral 基色 + Geist 字体）与该风格天然契合，以下规则在 shadcn 语义令牌之上落地。

### 色彩
- **单一强调色**，饱和度 < 80%。本项目强调色即 `--primary`（neutral 系 oklch），**不要引入第二个高饱和强调色**；红色仅用于 `--destructive` 语义（错误/删除），不做装饰。
- **严禁 "AI 紫" 霓虹**：紫色渐变、紫色发光按钮、霓虹渐变背景一律禁止（AI 生成 UI 的经典廉价感）。
- **不用纯黑 `#000`**：用 off-black / zinc-950（本项目 `--foreground: oklch(0.145 0 0)` 即此级别）。
- **中性色统一**：全项目只用一套灰阶（本项目为 neutral/zinc oklch 灰），不混冷暖灰系。

### 圆角与投影
- **大圆角**：卡片等容器用 `rounded-[2.5rem]`，或拉大 `--radius` 主题变量；按钮保持适度圆角。整体柔和、轻盈。
- **卡片**：`--card` 底、1px 半透明描边（`border-border`）、柔和投影 `shadow-[0_20px_40px_-15px_rgb(0_0_0/0.05)]`、内边距 2–2.5rem。**高密度布局不用卡片**，改用分隔线或留白。

### 排版（Geist）
- 本项目已用 **Geist Variable**（Stitch taste 明确偏好，**禁用 Inter** 与通用衬线体）。Display 字重驱动层级（700–900）、紧字距（`tracking-tight`）、压缩行高（~1.1）。
- Body 用 400 字重、宽松行高（~1.65）、正文行宽 ≤65ch。
- 代码/元数据/时间戳用**等宽字体**（Geist Mono / JetBrains Mono，可后续引入）。

### 组件行为
- **按钮**：平面填充、无外发光；primary = 强调色填充 + 白字；hover 用轻微位移/背景微变，**不用 glow**。
- **表单**：label 在上、helper 可选、错误文字在控件下方（destructive 红）、2px 强调色聚焦环、不用浮动 label。
- **加载**：用尺寸匹配布局的 **Skeleton**，不用圆形 spinner。
- **空状态**：图标/插画组合 + 引导文案，不裸写 "暂无数据"。
- **错误状态**：内联、上下文相关、红色下划线/边框 + 明确的恢复动作。

### 布局
- **禁止绝对定位重叠 / z-index 堆叠排版**（Dialog/Sheet 等叠加层组件除外）。
- **禁止"三个等宽卡片横排"的通用版式**：用 2 列 zig-zag、不对称网格或横向滚动。
- 布局优先 **CSS Grid**，不用 `calc()` 做百分比 hack。
- 容器用 max-width 约束（如 `max-w-[1400px] mx-auto`）。
- 全高区块用 `min-h-[100dvh]`，**不用 `h-screen`**（避免 iOS 地址栏跳动）。
- Hero 避免居中布局 → 左对齐 / 分栏 / 不对称留白；**最多一个主 CTA**，不加次要 "Learn more" 链接。
- 可用 **inline image typography**（标题文字间嵌入小图，Stitch 标志性手法），但各元素保持独立空间、不重叠。

### 动效
- 克制、流畅的 CSS 动效（`tw-animate-css` 足够），不做电影级编排；淡入、位移、轻微缩放即可。

## 代码规范（阿里 f2e-spec 风格）

遵循《阿里巴巴前端规约》的编码规范，落地到本项目的 TS/React 代码。
> 当前 `eslint.config.js` 为 Vite 默认配置，尚未接入 `eslint-config-ali`；下述规则作为团队约定执行，后续可接入 linter 强制校验。

### 命名
- 变量/函数/方法：**lowerCamelCase**（`userList`、`getUserById`）
- 类/组件/接口/类型：**PascalCase**（`UserCard`、`UserInfo`）
- 常量：**UPPER_SNAKE_CASE**（`MAX_PAGE_SIZE`）
- **布尔判断函数**用 `is`/`has`/`can` 开头，返回布尔：`isVisible`、`hasPermission`、`canSubmit`
- **取/设/载**动词：`get` 取值（返回非布尔）、`set` 设值、`load` 加载
- **数组/集合**用复数名词：`users`、`items`、`orders`
- **React**：组件文件与组件名一致（PascalCase）；自定义 Hook 用 `use` 前缀（`useUser`）；事件回调 props 用 `on` 前缀（`onSubmit`）
- **文件名**：组件 `UserCard.tsx`；非组件用 kebab-case（`use-auth.ts`、`api/user.ts`）

### 代码格式
- 缩进 **2 空格**；字符串统一**单引号**；语句结尾**分号**
- 用 `const`/`let`，**禁用 `var`**
- 比较用严格相等 `===` / `!==`
- 优先**解构赋值**、对象简写、模板字符串
- 嵌套三元/条件避免过深（超过 2 层用提前 return 提升可读性）
- 魔数（魔法数字）用命名常量，如 `const PAGE_SIZE = 20`

### TypeScript
- 描述对象结构用 **`interface`**（`interface UserInfo { ... }`）；联合类型、元组、工具类型用 `type`
- **不用 `any`**：未知值用 `unknown` + 类型收窄，或给具体类型；`noUnusedLocals` 已开启，废弃代码即删
- 不可变数据用 `readonly`（`readonly` 数组、`Readonly<T>`）
- 枚举成员名 PascalCase（`Status.Active`），或常量对象 + `as const`

### React
- **函数组件优先**，不用类组件
- 列表 `key` 用稳定唯一 id（`user.id`），**不用数组 index**
- 表单用**受控组件**；多组件共享状态提升到公共父组件
- 组件内不内联创建大对象/函数（用组件外常量、`useCallback`/`useMemo`，或抽取子组件）
- props 视为只读，不在子组件中修改
- 条件渲染避免三层以上嵌套三元，用提前 return 或 `&&` 短路

### HTML/CSS（Tailwind 落地）
- class 用 kebab-case（Tailwind 类名天然如此，自定义类名遵循同规）
- **避免内联样式**：一律用 Tailwind 工具类或 shadcn 语义令牌
- 颜色/间距/圆角走主题变量（`bg-primary`、`text-muted-foreground`），不写死 hex
- 语义化标签 + 图片 `alt`

### 注释与提交
- 注释说明 **why 而非 what**，与代码语言一致（本项目注释可用中文）
- 提交信息约定 `type(scope): subject` 格式（feat/fix/refactor/docs/style/test/chore）；项目当前未 git init，启用后按此执行

## 数据层模式

- **src/utils/axios.ts**: axios 基础设施（实例 `http`、响应拦截器解包 `{code,data,message}`、类型化请求方法 `request/get/post/put/del`、`ApiError`）。约定响应体为 `{ code, data, message }`，code=0/200 成功；cookie 鉴权（`withCredentials: true`）；401 时 dispatch `auth:unauthorized` 事件。**类型定义统一放 `src/types/`**（如 `ApiResponse<T>` 在 `src/types/api.ts`）。dev 下 `VITE_API_BASE_URL` 用**同源路径**（如 `/hip/api`），靠 `vite.config.ts` 的 `server.proxy` 转发到真实后端（如 `'/hip'` → `http://127.0.0.1`），保证 cookie 同源；后端地址由此只在 vite.config 一处维护，生产再用 `.env.production` 写完整地址。
- **src/api/**: 每个领域一个模块（如 `user.ts`），导出基于 `@/utils/axios` 请求方法的类型化请求函数。请求函数只负责取数/抛错，不持有状态。
- **server state**（与后端同步的数据）用 **TanStack Query**：`useQuery` 读、`useMutation` 写，查询键（queryKey）按领域集中定义。请求函数在组件外定义，组件内调 `useQuery`。
- **client state**（UI 本地状态，如当前选中项、侧边栏折叠）用 **Zustand**，store 按领域拆分放在 `src/store/`。
- **路由**：React Router v7，路由表集中放在 `src/routes/`，页面组件在 `src/pages/`，共享布局在 `src/layouts/`。

## 交互约定（固化）

- **删除必须二次确认**：所有删除操作统一用 `src/components/ConfirmPopover`（popover 二次确认）承接，禁止直接触发删除。
- **新增/编辑/删除的弹框**：统一用 `src/components/AppDialog`。
- **全局消息提示**：所有请求成功/失败的消息由 `src/utils/axios.ts` 拦截器统一处理（写操作 POST/PUT/DELETE 成功 + 所有请求失败，GET 查询成功不提示），页面无需手动弹 toast；**轮询等静默请求传 `{ silent: true }` 跳过**。手动提示用 `src/utils/message.ts` 的 `message.success/error/info/warning`（基于 sonner，`<Toaster />` 已挂载在 `src/main.tsx`）。

## 踩坑记录 / 环境注意事项

1. **shadcn CLI 4.19.0 崩溃**：在此环境（Windows + pnpm dlx）执行 init 会报 `Could not load the workspace config`。**固定用 `shadcn@4.18.0`** 可正常初始化、添加组件。`shadcn` 依赖本身留在 package.json 为 ^4.19.0 无碍，运行时手动指定版本即可。
2. **shadcn 初始化要求 paths 在根 tsconfig.json**：CLI 只读根 `tsconfig.json`，paths 仅写在 `tsconfig.app.json` 时别名会解析成 `cwd/@/...` 导致 init 失败。两处都要配 `"paths": { "@/*": ["./src/*"] }`。
3. **TS 6.0 弃用 `baseUrl`**：加 `baseUrl` 会报 TS5101，`tsc -b` 失败。`paths` 不带 `baseUrl` 独立可用（相对 tsconfig 解析）。
4. **Tailwind v4 无配置文件**：没有 `tailwind.config.js`/CSS 层配置，主题通过 CSS 变量 + `@theme inline` 写在 `src/index.css` 中。不要创建旧的 tailwind config。
5. **index.css 结构**：顶部 import tailwindcss / tw-animate-css / shadcn/tailwind.css（动画与 custom-variant）/ Geist 字体；随后是 `@theme inline` 颜色映射、`:root`（亮色）与 `.dark`（暗色）变量、`@layer base`。shadcn init 会整体重建此文件——原模板样式会被覆盖，改样式只改主题变量。
6. **字体**：Geist Variable（`@fontsource-variable/geist`），`--font-sans`/`--font-heading` 已映射，直接使用。
7. 项目**已是 git 仓库**（`master` 分支）；`src/index.css.bak`（初始模板样式备份）与 Vite 模板文件（`App.tsx`/`App.css`/`src/assets/*`）已在搭建管理后台时删除。
8. 本项目组件底层是 **Base UI**，查 shadcn 文档时选 base 文档页（`ui.shadcn.com/docs/components/base/[component]`），Radix 文档的 API 不适用。
9. **shadcn `add sidebar`（base-nova）不会自动装 `breadcrumb`**：sidebar.tsx 已不再内联面包屑，需要单独 `pnpm dlx shadcn@4.18.0 add breadcrumb`。
10. **生成的组件文件会触发 ESLint 报错**：`button.tsx`/`sidebar.tsx` 导出非组件值（`buttonVariants`/`useSidebar`）触发 `react-refresh/only-export-components`，`use-mobile.ts` 的 effect 内 setState 触发 `react-hooks/set-state-in-effect`。已在 `eslint.config.js` 加 override（`src/components/ui/**` + `src/hooks/use-mobile.ts` 关闭这两条），**不改生成文件本身**。
11. **Base UI sidebar 用法**：`SidebarMenuButton` 用 `render={<NavLink .../>}` 渲染成链接 + `isActive` prop（内部 `data-active` 着色），无需 `asChild`/`nativeButton`；`DropdownMenuContent` 默认 `w-(--anchor-width)` 跟随锚点宽度，需显式 `w-auto min-w-*` 覆盖；`SidebarTrigger` 折叠桌面侧边栏、移动端自动开 Sheet。

## 工作流建议

1. **改 UI**：先在 `src/components/ui/` 找现成 shadcn 组件，不重复添加、不自己造轮子。
2. **加组件**：`pnpm dlx shadcn@4.18.0 add <name>` → 通读生成文件 → 核对组合与图标库 → 用语义色接业务。
3. **修 bug**：先 `pnpm dev` 复现 → 定位是样式（Tailwind 类/主题变量）还是逻辑（query 缓存/store）→ 修复后 `pnpm lint` + `pnpm build` 验证。
4. **代码审查**：按上方"组件组合规则"、"UI 与样式规范"、"设计规范（Stitch）"与"代码规范（阿里）"逐条核对。
