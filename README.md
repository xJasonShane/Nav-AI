# Nav-AI

一个轻量、美观、纯静态的个性化导航站。数据保存在浏览器本地（localStorage），无需任何后端与数据库，构建产物可直接一键部署到 Cloudflare Pages、EdgeOne Pages 等边缘静态托管服务。

![技术栈](https://img.shields.io/badge/Vite-7-646CFF) ![Vue](https://img.shields.io/badge/Vue-3-42B883) ![部署](https://img.shields.io/badge/%E9%83%A8%E7%BD%B2-%E7%BA%AF%E9%9D%99%E6%80%81-2FA96E)

## 功能特性

- **分类管理**：支持两级分类（顶级分类 / 子分类），可自定义名称、图标（emoji）、排序（上移/下移）
- **站点管理**：添加、编辑、删除一步到位；卡片包含名称、图标、描述、标签、链接，可置顶到分类最前
- **站点排序**：排序模式下拖拽卡片调整顺序（拖到其它分组即移动分类，拖到分组空白处可移入空分类），并提供 ↑↓ 按钮供键盘与触屏使用
- **批量管理**：批量模式下整卡可勾选，支持全选、批量移动分类、批量删除（可整批撤销）
- **批量导入**：粘贴多行网址批量建条目；可直接导入浏览器导出的书签 HTML，按文件夹自动还原分类并去重
- **命令面板式搜索**：按名称、分类、标签、描述、网址实时过滤，结果按相关性排序并标注所属分类；`/` 聚焦、`↑↓` 选择、`Enter` 打开
- **浏览增强**：分类可折叠；「最近打开 / 最常访问」两个本地统计视图（数据不出本机）
- **智能图标**：图标可留空自动获取（默认先取站点自身 favicon，再走图标服务，全程 `no-referrer` 不回传来源），也可切换为「仅字母」完全不请求外部资源；失败自动回退为彩色字母头像
- **明暗主题与主色**：浅色 / 深色 / 跟随系统三态切换，无刷新闪烁；6 套主色预设、卡片密度与描述开关均可调
- **删除可撤销**：删除站点或整棵分类后 6 秒内可一键撤销
- **数据备份与分享**：一键导出 / 导入 JSON，导入前可预览并选择覆盖或合并（按网址去重）；支持导入浏览器书签、导出浏览器书签；覆盖式导入与「恢复默认」均可 6 秒内撤销；可导出**只读分享页**（数据与样式全部内联、零外部请求、跟随系统深色，直接发给他人即可查看）
- **可安装 / 离线可用（PWA）**：支持添加到主屏；Service Worker 做离线外壳（导航网络优先、静态资源缓存优先），数据本就在本地，离线打开功能完整
- **数据自愈**：导入或历史数据中的失效分类会自动归入「未分类」并给出提示（侧边栏与「全部分类」视图末尾都会展示该分组）；存储写入失败会明确告警而不是静默丢弃
- **多标签同步**：在多个标签页打开时自动保持一致
- **响应式**：桌面端侧边栏布局，移动端抽屉式导航，触摸友好，适配安全区（刘海屏）
- **无障碍**：键盘全程可达（卡片操作、弹窗焦点陷阱与焦点归还、跳过导航直达主内容）、可见焦点环、对比度达 WCAG AA、支持 `prefers-reduced-motion` 与强制高对比模式
- **统一设计令牌**：色彩 / 字号 / 间距 / 圆角 / 阴影 / 动效全部走 CSS 变量，明暗主题与主色一键切换

## 技术栈

| 项目 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3.5（Composition API + `<script setup>`） | 主流、轻量、中文生态好 |
| 构建 | Vite 7 | 秒级冷启动，产物为纯静态文件 |
| 状态 | Vue `reactive` 单例 store | 数据量小，无需引入 Pinia/Vuex |
| 持久化 | localStorage | 零依赖，数百站点无压力 |
| 样式 | 原生 CSS + CSS 变量（设计令牌体系） | 无 UI 框架依赖，产物极小；色/字/距/圆角/动效统一收口 |
| 图标 | 内联 SVG（统一线宽与尺寸） | 功能操作不用 emoji，跨平台渲染一致 |

> 备选方案：如需组件生态更丰富的版本，可平移到 **Vite + React**；如追求极致零构建，可改写为**原生 HTML/CSS/JS**。两者部署方式与本方案完全一致。

## 构建产物体积

```
dist/index.html                       2.11 kB │ gzip:  1.00 kB
dist/assets/style-*.css              31.66 kB │ gzip:  6.33 kB
dist/assets/index-*.js              117.56 kB │ gzip: 44.35 kB   # 首屏：入口 + 静态依赖
dist/assets/SiteModal-*.js            5.54 kB │ gzip:  2.46 kB   # 以下均按需加载
dist/assets/CategoryModal-*.js        8.03 kB │ gzip:  2.49 kB
dist/assets/DataModal-*.js            9.07 kB │ gzip:  4.50 kB
dist/assets/SettingsModal-*.js        4.08 kB │ gzip:  1.64 kB
dist/assets/importers-*.js            1.30 kB │ gzip:  0.71 kB
```

首屏全部资源 gzip 后约 **51 KB**（HTML + CSS + JS，另有 PWA 图标 ~14 KB），无外部字体/依赖请求。四个弹窗与书签/分享页解析按需加载，不进入首屏关键路径。`npm run check` 内置体积闸门（首屏 JS ≤ 52 kB / CSS ≤ 6.5 kB，gzip）与其它 10 项工程断言。

## 本地开发

```bash
# 安装依赖（Node.js >= 20.19）
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产版本（输出到 dist/）
npm run build

# 子路径部署（如 GitHub Pages 项目页 /repo/）时指定 base
VITE_BASE=/repo/ npm run build

# 本地预览构建产物（默认 http://localhost:4173）
npm run preview

# 数据层与视图纯函数单元测试（Node 内置 runner，零依赖）
npm test

# 附带覆盖率的测试（仅统计被 import 的模块）
npm run test:coverage

# 工程约束自检：设计令牌收口 / 品牌色 / v-html 与原生 confirm / 依赖白名单 /
# 构建特性标志 / STORAGE_KEY 口径 / 图标集中维护 / 主色预设一致性 /
# console.log 残留 / SFC scoped / 首屏体积预算
npm run check
```

> 提交前建议执行 `npm run build && npm test && npm run check`；CI（`.github/workflows/ci.yml`）也会在 push / PR 时执行同样三步。

## 部署到 Cloudflare Pages

### 方式一：Git 仓库自动部署（推荐）

1. 将本项目推送到 GitHub / GitLab 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**，选择仓库
3. 构建配置填写：
   - **Framework preset**: `Vite`（或 None）
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy**，之后每次 push 自动触发部署

### 方式二：直接上传（Wrangler CLI）

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=nav-ai
```

### 方式三：Dashboard 手动上传

**Workers & Pages** → **Create application** → **Pages** → **Upload assets**，将本地 `dist/` 目录拖入上传即可。

## 部署到 EdgeOne Pages

1. 登录 [腾讯云 EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)
2. **创建项目** → 选择 **Git 导入**（连接 GitHub/GitLab 仓库）或**本地上传**
3. Git 导入时构建配置填写：
   - **预设模板**: `Vite`（或自定义）
   - **构建命令**: `npm run build`
   - **输出目录**: `dist`
4. 点击开始部署，EdgeOne 会自动分配边缘加速域名，也可绑定自定义域名

> 本地构建上传的场景：先 `npm run build`，再把 `dist` 目录拖入控制台即可，无需任何运行环境。

## 部署到其他平台

本产物为纯静态资源，同样适用于：

- **GitHub Pages**：项目页部署在 `/<repo>/` 子路径，必须先 `VITE_BASE=/<repo>/ npm run build` 再发布 `dist`（否则图标、PWA 清单与 Service Worker 会 404）；用户页（`<user>.github.io` 根路径）按默认构建即可
- **Vercel / Netlify**：Framework 选 Vite，Build `npm run build`，Output `dist`
- **任意对象存储 / Nginx / CDN**：将 `dist` 目录内容上传即可

> 本项目为单页应用且未使用路由，无需配置任何 SPA 重写规则；如后续加入路由，再补 `/* → /index.html` 回退规则即可。

## 项目结构

```
Nav-AI/
├── index.html                  # 入口 HTML（主题/主色/密度防闪烁脚本、PWA 声明）
├── package.json
├── vite.config.js
├── .github/workflows/ci.yml    # CI：build + test + check（push / PR）
├── public/
│   ├── favicon.svg             # 站点图标
│   ├── manifest.webmanifest    # PWA 清单（相对路径，支持子路径部署）
│   ├── sw.js                   # 离线外壳（预缓存首屏资源 + 版本清理）
│   └── icon-*.png              # 主屏图标（由 scripts/generate-icons.mjs 生成）
├── scripts/
│   ├── check.mjs               # 工程约束自检（零依赖）
│   └── generate-icons.mjs      # PWA 图标生成（零依赖）
├── tests/
│   ├── data.test.mjs           # 数据层单元测试（零依赖）
│   └── view-logic.test.mjs     # 视图纯函数单元测试（搜索/分组/分享页/URL）
├── src/
│   ├── main.js                 # 应用入口（外观 + 错误兜底 + PWA 注册与更新提示）
│   ├── style.css               # 全局样式、设计令牌与主色/密度预设
│   ├── store/
│   │   └── data.js             # 数据层：CRUD、归一化、版本迁移、节流持久化
│   ├── composables/
│   │   ├── useSiteSearch.js    # 命令面板式搜索状态
│   │   └── useNavView.js       # 分类选中与分组视图
│   ├── utils/
│   │   ├── scroll-lock.js      # 滚动锁（引用计数）
│   │   ├── focus-trap.js       # 焦点陷阱（弹窗与移动端抽屉共用）
│   │   ├── toast.js            # 全局提示（含删除撤销）
│   │   ├── errors.js           # 运行时异常收集（提示条展示）
│   │   ├── drag.js             # 拖拽排序共享状态
│   │   ├── favicon.js          # 图标解析结果的会话缓存
│   │   ├── url.js              # URL 协议白名单与表单校验
│   │   ├── search.js           # 站点检索与相关性排序（纯函数）
│   │   ├── grouping.js         # 分组装配 / 分类扁平化（纯函数）
│   │   ├── importers.js        # 批量添加 / 书签 HTML 解析
│   │   └── export-page.js      # 只读分享页生成
│   ├── App.vue                 # 主布局、模式编排与全局快捷键（弹窗按需加载）
│   └── components/
│       ├── TopBar.vue          # 顶栏：品牌/搜索/主题/数据/管理模式
│       ├── SideBar.vue         # 侧边栏：分类树导航 + 分类管理/设置入口
│       ├── SiteCard.vue        # 站点卡片：图标回退链、排序/批量/选中态
│       ├── SiteModal.vue       # 站点添加（单个 / 批量）/ 编辑表单
│       ├── CategoryModal.vue   # 分类管理（增删改/排序/子分类）
│       ├── DataModal.vue       # 数据导入导出 / 书签导入 / 分享页 / 恢复默认
│       ├── SettingsModal.vue   # 设置：标题 / 主题 / 主色 / 密度 / 描述 / 图标源
│       ├── Modal.vue           # 通用弹窗外壳（焦点陷阱/归还/滚动锁）
│       ├── ConfirmCard.vue     # 统一确认卡（替代原生 confirm）
│       ├── EmptyState.vue      # 统一空状态
│       ├── Toast.vue           # 全局提示条
│       └── Icon.vue            # 功能图标（内联 SVG 路径表）
└── docs/                       # 本地文档（默认未纳入版本控制；如需随仓库分发，删掉 .gitignore 的 docs/ 一行）
    ├── usage.md                # 功能使用说明
    └── ui-audit-and-plan.md    # UI 审计、改造计划与实施记录
```

## 数据说明

- 所有数据存储在浏览器 `localStorage`，键名 `nav-ai-data-v1`，仅保存在当前浏览器中
- 数据结构：`categories`（两级分类树）+ `sites`（站点集合）+ `settings`（标题、主题、主色、图标源、密度、描述开关）+ `version`（数据版本号，加载与导入时自动迁移到当前版本）
- 每个站点包含 `pinned`（置顶）、`visits` / `lastVisited`（本地使用统计）、`tags`（标签）；统计只保存在当前浏览器，不会上报
- 旧版本备份（`version: 1`）无需处理：加载与导入时会自动升级版本并补齐缺省字段，失效分类的站点会归入「未分类」并提示
- 换设备/换浏览器时，通过右上角「数据管理」导出 JSON，在新设备导入即可完整迁移；也可以直接导入浏览器书签 HTML
- 修改站点标题：点击侧边栏底部「设置」（或直接编辑 `src/store/data.js` 中的 `defaultData()`）