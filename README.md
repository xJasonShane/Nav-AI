# Nav-AI

一个轻量、美观、纯静态的个性化导航站。数据保存在浏览器本地（localStorage），无需任何后端与数据库，构建产物可直接一键部署到 Cloudflare Pages、EdgeOne Pages 等边缘静态托管服务。

![技术栈](https://img.shields.io/badge/Vite-7-646CFF) ![Vue](https://img.shields.io/badge/Vue-3-42B883) ![部署](https://img.shields.io/badge/%E9%83%A8%E7%BD%B2-%E7%BA%AF%E9%9D%99%E6%80%81-2FA96E)

## 功能特性

- **分类管理**：支持两级分类（顶级分类 / 子分类），可自定义名称、图标（emoji）、排序（上移/下移）
- **站点管理**：添加、编辑、删除一步到位；卡片包含名称、图标、描述、链接
- **智能图标**：站点图标地址留空时自动抓取目标网站 favicon，失败自动回退为彩色字母头像
- **即时搜索**：按名称、描述、网址实时过滤，快捷键 `/` 聚焦搜索框
- **明暗主题**：浅色 / 深色 / 跟随系统三态切换，无刷新闪烁
- **数据备份**：一键导出 / 导入 JSON，支持跨设备迁移；可恢复默认演示数据
- **响应式**：桌面端侧边栏布局，移动端抽屉式导航，触摸友好

## 技术栈

| 项目 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3.5（Composition API + `<script setup>`） | 主流、轻量、中文生态好 |
| 构建 | Vite 7 | 秒级冷启动，产物为纯静态文件 |
| 状态 | Vue `reactive` 单例 store | 数据量小，无需引入 Pinia/Vuex |
| 持久化 | localStorage | 零依赖，数百站点无压力 |
| 样式 | 原生 CSS + CSS 变量 | 无 UI 框架依赖，产物极小 |

> 备选方案：如需组件生态更丰富的版本，可平移到 **Vite + React**；如追求极致零构建，可改写为**原生 HTML/CSS/JS**。两者部署方式与本方案完全一致。

## 构建产物体积

```
dist/index.html                   1.13 kB │ gzip:  0.72 kB
dist/assets/style-*.css          16.59 kB │ gzip:  3.82 kB
dist/assets/index-*.js          104.70 kB │ gzip: 39.20 kB
```

全部资源 gzip 后约 **44 KB**，无外部字体/依赖请求，首屏秒开。

## 本地开发

```bash
# 安装依赖（Node.js >= 20.19）
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产版本（输出到 dist/）
npm run build

# 本地预览构建产物（默认 http://localhost:4173）
npm run preview
```

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

- **GitHub Pages**：push `dist` 到 `gh-pages` 分支（可用 `gh-pages` 包或 Actions 自动化）
- **Vercel / Netlify**：Framework 选 Vite，Build `npm run build`，Output `dist`
- **任意对象存储 / Nginx / CDN**：将 `dist` 目录内容上传即可

> 本项目为单页应用且未使用路由，无需配置任何 SPA 重写规则；如后续加入路由，再补 `/* → /index.html` 回退规则即可。

## 项目结构

```
Nav-AI/
├── index.html                  # 入口 HTML（含主题防闪烁脚本）
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg             # 站点图标
├── src/
│   ├── main.js                 # 应用入口
│   ├── style.css               # 全局样式与主题变量
│   ├── store/
│   │   └── data.js             # 数据层：分类树/站点 CRUD + localStorage 持久化
│   ├── App.vue                 # 主布局与视图编排
│   └── components/
│       ├── TopBar.vue          # 顶栏：品牌/搜索/主题/数据/管理模式
│       ├── SideBar.vue         # 侧边栏：分类树导航（移动端抽屉）
│       ├── SiteCard.vue        # 站点卡片：图标回退 + 管理操作
│       ├── SiteModal.vue       # 站点添加/编辑表单
│       ├── CategoryModal.vue   # 分类管理（增删改/排序/子分类）
│       ├── DataModal.vue       # 数据导入/导出/重置
│       └── Modal.vue           # 通用弹窗外壳
└── docs/
    └── usage.md                # 功能使用说明
```

## 数据说明

- 所有数据存储在浏览器 `localStorage`，键名 `nav-ai-data-v1`，仅保存在当前浏览器中
- 数据结构：`categories`（两级分类树）+ `sites`（站点集合）+ `settings`（标题与主题）
- 换设备/换浏览器时，通过右上角「数据管理」导出 JSON，在新设备导入即可完整迁移
- 修改站点标题：编辑 `src/store/data.js` 中的 `defaultData()`，或在已部署站点中修改后导出备份保留