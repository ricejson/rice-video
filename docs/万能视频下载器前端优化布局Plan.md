# 万能视频下载器 前端绿白风格 UI 改造方案

> 设计方案 | 2026-05-01

---

## 一、需求背景

**现状**：前端 UI 使用蓝紫渐变（blue-500 → indigo-600）的玻璃拟态风格。

**目标**：将整体 UI 风格改为「绿白凤」设计风格，参考 `docs/参考.webp` 的配色体系。

**约束**：只修改前端代码，不改动后端。

---

## 二、参考图配色体系分析

通过 Pillow 对参考图进行像素采样分析（3336×1986px），提取到以下配色体系：

### 2.1 色彩矩阵

| 角色 | Hex | Tailwind 近似 | 用途 |
|------|-----|--------------|------|
| 主强调色 | `#10b050` | emerald-500 / green-500 | 按钮、链接、重点元素 |
| 主强调色深 | `#10a050` | emerald-600 | hover/active 状态 |
| 辅助绿 | `#20b050` | green-500 | 渐变终点、图标 |
| 主背景 | `#f0f0f0` | gray-100 | 页面全局背景 |
| 绿调背景 | `#e0f0e0` | green-50 | 卡片/面板的淡绿底色 |
| 深色区背景 | `#d0f0e0` | green-100 | 特定面板的明显绿调 |
| 深色文字 | `#101020` | gray-900 | 标题、正文文字 |
| 灰色文字 | `#505060` | gray-600 | 次要文字 |

### 2.2 风格特征

- **底座**：纯白/浅灰白为主色（`#f0f0f0`），不是蓝色渐变
- **点缀**：翠绿色 `#10b050` 作为品牌强调色
- **卡片**：白色底 + 极淡绿色调，简洁投影
- **对比**：高对比度文字（深色 `#101020` 配浅色底）
- **整体感受**：清新、干净、自然、专业

---

## 三、改动范围分析

### 3.1 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `web/src/app/globals.css` | 修改 | 新增绿色 CSS 变量和动画 |
| `web/src/app/page.tsx` | 修改 | 背景色从蓝渐变 → 浅灰白 |
| `web/src/app/layout.tsx` | 不变 | 无需修改 |
| `web/src/components/Header.tsx` | 修改 | Logo 渐变、导航按钮颜色 |
| `web/src/components/ParseBar.tsx` | 修改 | 输入框焦点色、解析按钮渐变、状态标签 |
| `web/src/components/VideoPanel.tsx` | 修改 | Loading 动画色、下载完成按钮 |
| `web/src/components/VideoPreviewCard.tsx` | 修改 | 封面占位图、平台标签、下载按钮、Playlist 选中态 |
| `web/src/components/SummaryPanel.tsx` | 修改 | AI 标签渐变色、Loading 动画 |
| `web/src/components/SummaryCard.tsx` | 修改 | Tab 按钮激活态、打字机光标 |
| `web/src/components/ChatPanel.tsx` | 修改 | 消息气泡渐变、发送按钮 |
| `web/src/components/MindMapViewer.tsx` | 修改 | 节点颜色、连线颜色、Canvas 下载色 |
| `web/src/components/ProgressBar.tsx` | 修改 | 进度条渐变、完成态颜色 |
| `web/src/components/PricingCard.tsx` | 修改 | 最受欢迎标签、订阅按钮、标题渐变 |
| `web/src/components/DownloadCard.tsx` | 修改 | 错误提示色(不变) |
| `web/src/app/login/page.tsx` | 修改 | 背景、按钮、链接色 |
| `web/src/app/register/page.tsx` | 修改 | 背景、按钮、链接色 |
| `web/src/app/success/page.tsx` | 修改 | 背景、成功图标 |
| `web/src/app/account/page.tsx` | 修改 | 背景、升级按钮 |

### 3.2 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `web/src/contexts/AuthContext.tsx` | 纯逻辑，无样式 |
| `web/src/lib/api.ts` | 纯逻辑，无样式 |

---

## 四、色彩映射方案

### 4.1 系统级颜色映射

| 当前值 (蓝紫系) | 新值 (绿白系) | 使用场景 |
|---|---|---|
| `from-blue-500 to-indigo-600` | `from-emerald-500 to-green-600` | 主按钮渐变 |
| `from-blue-500 to-indigo-500` | `from-emerald-500 to-green-500` | 次级按钮渐变 |
| `from-blue-600 to-indigo-600` | `from-emerald-600 to-green-600` | 标题文字渐变 |
| `from-blue-50 via-white to-indigo-50` | `bg-[#f0f0f0]` | 页面主背景 |
| `bg-blue-50` / `text-blue-600` | `bg-green-50` / `text-emerald-600` | 标签、徽章 |
| `border-blue-500` | `border-emerald-500` | 输入框焦点 |
| `from-blue-100 to-indigo-100` | `from-emerald-50 to-green-50` | 封面占位图 |
| `shadow-blue-500/25` | `shadow-emerald-500/20` | 按钮阴影 |
| `shadow-blue-500/20` | `shadow-emerald-500/15` | 卡片/消息阴影 |
| `text-blue-400` | `text-emerald-400` | 图标色 |
| `text-blue-500` | `text-emerald-500` | 链接、展开按钮 |
| `text-blue-600` | `text-emerald-600` | 链接 hover |
| `hover:text-blue-600` | `hover:text-emerald-600` | 导航链接 hover |
| `bg-blue-500` | `bg-emerald-500` | Playlist 选中态 |
| `bg-blue-100` | `bg-emerald-50` | 下载按钮背景 |
| `text-blue-600` | `text-emerald-600` | 下载按钮文字 |
| `hover:bg-blue-200` | `hover:bg-emerald-100` | 下载按钮 hover |
| `bg-blue-500/90` | `bg-emerald-500/90` | Playlist 标签背景 |
| `stroke="#818cf8"` | `stroke="#34d399"` | 思维导图连线 |
| `stroke="url(#lineG)"` with indigo | emerald gradient | 思维导图连线渐变 |
| `from-blue-500 to-indigo-600` (思维导图根节点) | `from-emerald-500 to-green-600` | 思维导图根节点 |

### 4.2 紫色到绿色的特殊映射

当前有部分元素使用紫色（purple-pink），如 AI 总结的图标：
| 当前值 | 新值 | 场景 |
|---|---|---|
| `from-purple-500 to-pink-500` | `from-emerald-400 to-green-500` | AI 图标渐变 |
| `bg-purple-400` | `bg-emerald-400` | Loading 动画点 |

### 4.3 保持不变的颜色

- 红色系（错误提示）：`bg-red-50`、`text-red-600`
- 绿色系（完成状态）：`from-green-500 to-green-600`（下载完成按钮）
- 黄色系（VIP 徽章）：`from-amber-400 to-orange-500`
- 灰色系（文字层级、背景层级）

---

## 五、组件级改动方案

### 5.1 `globals.css`

```css
/* 新增 CSS 变量 */
:root {
  --primary: #10b050;
  --primary-light: #e0f0e0;
  --background: #f0f0f0;
}

/* 新增自定义滚动条样式（绿色版） */
```

### 5.2 `page.tsx` - 主页面

```
- 背景: bg-gradient-to-br from-blue-50 via-white to-indigo-50
+ 背景: bg-[#f0f0f0]
```

### 5.3 `Header.tsx` - 页面头部

```
- Logo 图标: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 标题渐变: from-blue-600 to-indigo-600 → from-emerald-600 to-green-600
- 导航链接: hover:text-blue-600 → hover:text-emerald-600
- 注册按钮: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
```

### 5.4 `ParseBar.tsx` - URL 输入栏

```
- 配额标签: bg-blue-50 text-blue-600 → bg-green-50 text-emerald-600
- 输入框焦点: focus:border-blue-500 → focus:border-emerald-500
- 解析按钮: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
```

### 5.5 `VideoPanel.tsx` - 视频面板

```
- 解析中图标: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
```

### 5.6 `VideoPreviewCard.tsx` - 视频预览卡片

```
- 封面占位图: from-blue-100 to-indigo-100 → from-emerald-50 to-green-50
- 封面图标: text-blue-400 → text-emerald-400
- 平台标签: bg-blue-50 text-blue-600 → bg-green-50 text-emerald-600
- Playlist 标签: bg-blue-500/90 → bg-emerald-500/90
- Playlist 条目选中: bg-blue-50 border-blue-500 → bg-green-50 border-emerald-500
- Playlist 选中勾: bg-blue-500 → bg-emerald-500
- 展开按钮: text-blue-500 hover:text-blue-600 → text-emerald-500 hover:text-emerald-600
- 下载按钮: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
- 全选按钮: text-blue-600 hover:bg-blue-50 → text-emerald-600 hover:bg-green-50
```

### 5.7 `SummaryPanel.tsx` - 总结面板

```
- 等待解析图标: from-purple-500 to-pink-500 → from-emerald-400 to-green-500
- 总结中 Loading 点: bg-purple-400 → bg-emerald-400
```

### 5.8 `SummaryCard.tsx` - 总结卡片

```
- AI 图标: from-purple-500 to-pink-500 → from-emerald-400 to-green-500
- Tab 激活态: from-blue-500 to-indigo-500 → from-emerald-500 to-green-500
- Tab 激活阴影: shadow-blue-500/25 → shadow-emerald-500/20
- 打字机光标: bg-blue-500 → bg-emerald-500
- Loading 动画点: bg-blue-400 → bg-emerald-400
- 思维导图生成中图标: from-indigo-400 to-purple-500 → from-emerald-400 to-green-500
- 思维导图 Loading 点: bg-indigo-400 → bg-emerald-400
- 字幕下载按钮: bg-blue-100 hover:bg-blue-200 text-blue-600 → bg-emerald-50 hover:bg-emerald-100 text-emerald-600
```

### 5.9 `ChatPanel.tsx` - AI 对话

```
- 用户消息气泡: from-blue-500 to-indigo-500 → from-emerald-500 to-green-500
- 用户消息阴影: shadow-blue-500/20 → shadow-emerald-500/15
- 输入框焦点: focus:border-blue-500 → focus:border-emerald-500
- 发送按钮: from-blue-500 to-indigo-500 → from-emerald-500 to-green-500
- 发送按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
```

### 5.10 `MindMapViewer.tsx` - 思维导图

```
- 连线色: #818cf8 (indigo-400) → #34d399 (emerald-400)
- 连线渐变: #a5b4fc → #6366f1 → #6ee7b7 → #10b050
- 根节点: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 根节点阴影: shadow-blue-500/30 → shadow-emerald-500/20
- L1 节点: from-indigo-400 to-purple-500 → from-emerald-400 to-green-500
- L1 节点阴影: shadow-indigo-500/20 → shadow-emerald-500/15
- L2 节点边框: border-indigo-200 → border-emerald-200
- Canvas 下载：
  - 连线色: #818cf8 → #34d399
  - 根节点: #3b82f6/#4f46e5 → #10b050/#059669
  - L1 节点: #818cf8/#a855f7 → #34d399/#10b050
  - L2 节点边框: #a5b4fc → #6ee7b7
- 下载按钮: bg-blue-100 hover:bg-blue-200 text-blue-600 → bg-emerald-50 hover:bg-emerald-100 text-emerald-600
```

### 5.11 `ProgressBar.tsx` - 进度条

```
当前进度条已使用 blue-500→indigo-600 和 green-400→green-500（完成态）

- 进行中: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 完成态: from-green-400 to-green-500 (保持不变)
- 失败态: from-red-400 to-red-500 (保持不变)
```

### 5.12 `PricingCard.tsx` - 订阅套餐

```
- 标题渐变: from-blue-600 to-indigo-600 → from-emerald-600 to-green-600
- 最受欢迎标签: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- VIP 卡片边框: border-blue-200 → border-emerald-200
- VIP 卡片阴影: shadow-blue-500/20 → shadow-emerald-500/15
- VIP 按钮: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
```

### 5.13 各页面 (login/register/success/account)

```
- 页面背景: from-blue-50 via-white to-indigo-50 → bg-[#f0f0f0]
- 标题渐变: from-blue-600 to-indigo-600 → from-emerald-600 to-green-600
- 输入框焦点: focus:border-blue-500 → focus:border-emerald-500
- 主按钮: from-blue-500 to-indigo-600 → from-emerald-500 to-green-600
- 按钮阴影: shadow-blue-500/25 → shadow-emerald-500/20
- 链接色: text-blue-600 → text-emerald-600
```

---

## 六、组件详细改动代码示例

### 6.1 Header.tsx 关键改动

```tsx
// Logo 图标
<div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
// 标题
<h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
// 导航链接
<a href="#" className="text-gray-600 hover:text-emerald-600 transition-colors font-medium text-sm">
// 注册按钮
className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all"
```

### 6.2 page.tsx 关键改动

```tsx
// 主背景
<div className="min-h-screen bg-[#f0f0f0]">
```

### 6.3 ParseBar.tsx 关键改动

```tsx
// 配额标签
className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs bg-green-50 text-emerald-600"
// 输入框
className="w-full px-5 py-3.5 bg-gray-50/80 rounded-xl border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all outline-none text-gray-700 placeholder-gray-400"
// 解析按钮
className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
```

---

## 七、实施步骤

### Step 1：修改 globals.css - CSS 变量
- 新增绿色系 CSS 变量和自定义动画

### Step 2：修改全局布局页面
- `page.tsx`：背景色
- `layout.tsx`：无需改动

### Step 3：修改通用组件（无依赖）
- `Header.tsx`
- `ProgressBar.tsx`

### Step 4：修改功能组件
- `ParseBar.tsx`
- `PricingCard.tsx`

### Step 5：修改视频相关组件
- `VideoPanel.tsx`
- `VideoPreviewCard.tsx`

### Step 6：修改总结相关组件
- `SummaryPanel.tsx`
- `SummaryCard.tsx`
- `ChatPanel.tsx`
- `MindMapViewer.tsx`

### Step 7：修改子页面
- `login/page.tsx`
- `register/page.tsx`
- `success/page.tsx`
- `account/page.tsx`

### Step 8：构建验证
- `npm run build` 确认无编译错误

---

## 八、验收标准

- [ ] 全局背景改为浅灰白色（`#f0f0f0`）
- [ ] 所有主按钮改为翠绿色渐变（emerald-500 → green-600）
- [ ] 所有强调文字、链接、标签改为翠绿色系
- [ ] 卡片保持白色/半透明，配色和谐
- [ ] 思维导图节点和连线改为绿色系
- [ ] 输入框焦点色改为翠绿色
- [ ] 错误/成功颜色保持不变
- [ ] VIP 徽章保持金色不变
- [ ] 无 TypeScript 编译错误
- [ ] 后端无需任何修改
- [ ] 所有页面的交互功能不受影响

---

> **文档状态**：方案设计完成，待人工确认后实施
>
> 更新日期：2026-05-01
