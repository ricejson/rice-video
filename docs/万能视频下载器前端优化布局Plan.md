# 万能视频下载器 前端优化布局 实现方案

> 实施方案 | 2026-04-26

---

## 一、需求回顾

**现状**：视频解析下载 + 视频总结功能已完成，但布局为上下堆叠，且视频总结仅在用户手动点击 "AI 总结" 按钮后才会出现在下方。

**目标**：
1. 改为**左右布局**，视频解析/下载在左侧，AI 总结在右侧，同屏展示
2. 用户输入链接并解析成功后，**右侧自动触发 AI 总结**（无需手动点击）
3. 布局更紧凑，充分利用宽屏空间

---

## 二、当前架构分析

### 2.1 现有页面结构（垂直布局）

```
┌──────────────────────────────────────────┐
│              Header (Header.tsx)          │
├──────────────────────────────────────────┤
│                                          │
│    ┌──────────────────────────────┐      │
│    │  输入框 + 解析按钮            │      │
│    │  (DownloadCard input stage)   │      │
│    └──────────────────────────────┘      │
│                                          │
│    ┌──────────────────────────────┐      │
│    │  解析中 Loading               │      │
│    │  (DownloadCard parsing stage) │      │
│    └──────────────────────────────┘      │
│                                          │
│    ┌──────────────────────────────┐      │
│    │  视频预览卡片                  │      │
│    │  (VideoPreviewCard)           │      │
│    │  [下载] [AI总结] [取消]        │      │
│    └──────────────────────────────┘      │
│                                          │
│    ┌──────────────────────────────┐      │
│    │  下载进度条                    │      │
│    │  (ProgressBar)                │      │
│    └──────────────────────────────┘      │
│                                          │
│    ┌──────────────────────────────┐      │
│    │  AI 总结卡片 (按需出现)        │      │
│    │  (SummaryCard)                │      │
│    │  Tabs: 总结/导图/对话/字幕     │      │
│    └──────────────────────────────┘      │
│                                          │
│    ┌──────────────────────────────┐      │
│    │  PricingCard                  │      │
│    └──────────────────────────────┘      │
│                                          │
└──────────────────────────────────────────┘
```

### 2.2 数据流梳理

```
用户输入URL → POST /api/parse → 轮询 GET /api/parse/{id} → 解析完成
  ↓
用户点击"下载" → POST /api/download → 轮询 GET /api/download/status/{id}
  ↓
用户点击"AI总结" → SSE POST /api/summarize/stream → 流式返回文本+思维导图

关键API端点（无需后端改动）：
- POST /api/parse          - 提交解析
- GET  /api/parse/{id}     - 轮询解析结果
- POST /api/download       - 提交下载
- GET  /api/download/status/{id}  - 轮询下载状态
- POST /api/summarize/stream     - SSE流式总结（当前使用方式）
- POST /api/summarize/chat       - AI对话
```

### 2.3 现有组件一览

| 组件 | 职责 | 是否需要修改 |
|------|------|-------------|
| `page.tsx` | 主页面布局 | ✅ 需要大幅改造 |
| `DownloadCard.tsx` | 核心业务逻辑（解析/下载/总结） | ✅ 需要拆分 |
| `VideoPreviewCard.tsx` | 视频预览信息展示 | ✅ 需拆分下载按钮 |
| `SummaryCard.tsx` | 总结结果Tab展示 | ✅ 需要改造 |
| `MindMapViewer.tsx` | 思维导图渲染 | 不变 |
| `ChatPanel.tsx` | AI对话面板 | 不变 |
| `ProgressBar.tsx` | 下载进度条 | 不变 |
| `Header.tsx` | 页面头部 | 不变 |
| `PricingCard.tsx` | 定价卡片 | 保留但移到下方 |

---

## 三、设计方案

### 3.1 布局设计（左右同屏）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Header (Header.tsx)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  URL 输入栏 (全宽，顶部)                                              │   │
│   │  [ 粘贴视频链接...                                          ] [解析] │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌────────────────────────────────┬──────────────────────────────────────┐ │
│   │                                │                                      │ │
│   │  左栏：视频解析 & 下载          │  右栏：AI 总结                        │ │
│   │  (~45% 宽度)                   │  (~55% 宽度)                         │ │
│   │                                │                                      │ │
│   │  ┌────────────────────────┐   │  ┌────────────────────────────────┐  │ │
│   │  │  视频预览卡片           │   │  │  总结结果展示区                  │  │ │
│   │  │  (封面+标题+描述)       │   │  │  自动触发，SSE流式输出           │  │ │
│   │  │                        │   │  │                                │  │ │
│   │  │  [下载视频] [取消]     │   │  │  Tabs: 总结/导图/对话/字幕      │  │ │
│   │  └────────────────────────┘   │  └────────────────────────────────┘  │ │
│   │                                │                                      │ │
│   │  ┌────────────────────────┐   │                                      │ │
│   │  │  下载进度条             │   │                                      │ │
│   │  └────────────────────────┘   │                                      │ │
│   │                                │                                      │ │
│   └────────────────────────────────┴──────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  PricingCard                                                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 交互流程

```
用户输入URL → 点击解析
  │
  ├──→ 左栏：显示"解析中..."Loading
  │
  ├──→ 右栏：同步显示"正在提取字幕..."Loading（自动触发）
  │
  ▼ 解析完成
  │
  ├──→ 左栏：显示视频预览卡片 + [下载] [取消] 按钮
  │
  ├──→ 右栏：继续流式输出AI总结（SSE文本逐字出现）
  │           → 文本完成后，异步生成思维导图
  │           → 用户可切换Tab查看导图/对话/字幕
  │
  ▼ 用户点击"下载"
  │
  └──→ 左栏下方显示下载进度条
```

### 3.3 状态设计

当前 `DownloadCard` 用一个 `Stage` 枚举 + 一堆 `useState` 管理所有状态，耦合严重。
新方案将状态分为**两个独立区域**：

**共享状态**（左右两栏共用）：
- `url` - 用户输入的URL
- `parsedVideo` - 解析后的视频信息
- `summaryTaskId` - 总结任务ID（用于AI对话）
- `error` - 全局错误提示

**左栏状态**（下载区域）：
- `downloadTaskId` - 下载任务ID
- `downloadStatus` - 下载进度/速度/ETA
- `stage` - `input` | `parsing` | `parsed` | `downloading`

**右栏状态**（总结区域）：
- `summaryResult` - 总结结果（text_summary, mindmap, transcript）
- `isSummarizing` - 是否正在生成总结
- `activeTab` - 当前Tab（summary/mindmap/chat/transcript）

### 3.4 组件拆分方案

```
web/src/components/
├── ParseBar.tsx            # 新增：URL输入栏（从DownloadCard提取）
├── VideoPanel.tsx          # 新增：左侧视频面板（预览卡片+下载进度）
├── SummaryPanel.tsx        # 新增：右侧总结面板（自动触发+Tab展示）
├── VideoPreviewCard.tsx    # 保留但简化：去掉"AI总结"按钮，去掉Playlist选择
├── DownloadCard.tsx        # 重构：作为容器组件，整合左右两栏
├── SummaryCard.tsx         # 保留Tab切换逻辑，适配新布局
├── MindMapViewer.tsx       # 不变
├── ChatPanel.tsx           # 不变
├── ProgressBar.tsx         # 不变
└── Header.tsx              # 不变
```

**关键改动说明**：
1. `DownloadCard.tsx` 从"全功能卡片"变为"布局容器"，负责状态管理和左右布局
2. 所有业务逻辑（解析/下载/总结SSE流）从 `DownloadCard` 提取到独立 hooks 或保留在 `DownloadCard` 但按区域分发
3. `VideoPreviewCard` 去掉"AI总结"按钮（因为右侧自动触发，不需要按钮）
4. `SummaryCard` 保留Tab切换逻辑，适配新布局（去掉关闭按钮，改为常驻显示）

---

## 四、详细技术方案

### 4.1 核心改动：DownloadCard.tsx 重构

**保留的逻辑**：
- `handleParse` - 解析流程（POST /api/parse + 轮询）
- `pollParseResult` - 解析轮询
- `handleDownload` / `handleCancel` - 下载流程
- `handleSummarize` - SSE流式总结（改为自动触发）
- `handleDownloadFile` - 文件下载
- `handleCloseSummary` - 改为重置右栏

**拆分出的组件**：

#### 4.1.1 ParseBar.tsx
```
从 DownloadCard 的"输入状态"提取
Props: { url, onChange, onParse, loading, error }
```

#### 4.1.2 VideoPanel.tsx
```
包含：
- VideoPreviewCard（去掉AI总结按钮）
- ProgressBar（下载进度）
- 下载按钮 + 取消按钮

Props: {
  video, stage, loading, downloadTaskId,
  onDownload, onCancel, onDownloadFile,
  selectedEntries, onEntryToggle,
  task (包含进度/速度/ETA)
}
```

#### 4.1.3 SummaryPanel.tsx
```
包含：
- 自动触发的SSE总结流
- Tab切换（总结/导图/对话/字幕）
- 加载状态展示

Props: {
  url, parsedVideo,
  summaryResult, isSummarizing,
  summaryTaskId, activeTab, onTabChange,
  onError
}
```

### 4.2 布局实现

使用 Tailwind CSS 的 Grid/Flex 实现左右布局：

```tsx
// DownloadCard.tsx 主结构
<div className="w-full max-w-7xl mx-auto">
  {/* URL 输入栏 - 全宽 */}
  <ParseBar ... />

  {/* 左右两栏 */}
  {stage !== "input" && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* 左栏：视频解析 & 下载 */}
      <VideoPanel ... />

      {/* 右栏：AI 总结 */}
      <SummaryPanel ... />
    </div>
  )}

  {/* 定价卡片 */}
  <PricingCard />
</div>
```

**响应式**：
- `lg` 及以上：左右两栏（`grid-cols-2`）
- 小屏：自动堆叠为单列（`grid-cols-1`）

### 4.3 自动触发AI总结的时机

**方案**：在解析完成后（`stage === "parsed"`），立即自动调用 `handleSummarize()`。

```tsx
// DownloadCard.tsx
useEffect(() => {
  if (stage === "parsed" && task?.url && !summaryResult && !isSummarizing) {
    handleSummarize(); // 自动触发
  }
}, [stage]);
```

### 4.4 SSE总结流的改造

当前 SSE 流逻辑在 `handleSummarize` 中，需要改造为：
1. 自动触发，不需要用户点击按钮
2. 流式输出到右栏的"总结"Tab
3. 保持现有的打字机效果
4. 思维导图异步生成后自动更新

**关键改造点**：
- 移除 `summarizeLoading` 状态，改为右栏始终显示"总结中"Loading
- SSE事件处理逻辑不变，只改触发时机
- `SummaryPanel` 组件内部管理Tab切换

---

## 五、修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `web/src/app/page.tsx` | 修改 | 调整主容器宽度从 max-w-5xl → max-w-7xl |
| `web/src/components/DownloadCard.tsx` | **重构** | 从全功能卡片变为布局容器，管理左右两栏状态 |
| `web/src/components/ParseBar.tsx` | **新增** | URL输入栏组件 |
| `web/src/components/VideoPanel.tsx` | **新增** | 左侧视频面板（预览+下载） |
| `web/src/components/SummaryPanel.tsx` | **新增** | 右侧总结面板（自动SSE+Tab） |
| `web/src/components/VideoPreviewCard.tsx` | **修改** | 去掉"AI总结"按钮，简化操作按钮 |
| `web/src/components/SummaryCard.tsx` | **修改** | 适配新布局，去掉关闭按钮，改为常驻 |
| `web/src/components/MindMapViewer.tsx` | 不变 | 无需修改 |
| `web/src/components/ChatPanel.tsx` | 不变 | 无需修改 |
| `web/src/components/ProgressBar.tsx` | 不变 | 无需修改 |
| `web/src/components/Header.tsx` | 不变 | 无需修改 |

**后端无需任何修改**，所有API接口保持不变。

---

## 六、后端影响评估

✅ **无需后端改动**。原因：
1. 所有API接口（`/api/parse`, `/api/download`, `/api/summarize/stream`, `/api/summarize/chat`）保持不变
2. SSE流式输出逻辑不变，只是前端自动触发而非用户点击
3. 数据模型（Task、SummaryTask）不变
4. 业务逻辑（yt-dlp解析、阿里云百炼总结）不变

---

## 七、风险与注意事项

### 7.1 响应式设计
- 左右布局在宽屏（≥1024px）上效果最佳
- 小屏设备自动降级为上下堆叠（`grid-cols-1`）
- 需确保所有卡片在小屏上正常显示

### 7.2 自动触发的副作用
- 解析完成后立即触发AI总结，会额外消耗阿里云API调用
- 用户可能不想看总结（只想下载），但仍会触发
- 需要在右栏提供"关闭总结"的选项

### 7.3 组件拆分复杂度
- `DownloadCard` 当前有680+行代码，状态耦合严重
- 拆分时需确保所有状态正确传递
- `pollingRef`、`summarizeAbortRef` 等 ref 需要正确迁移

### 7.4 样式一致性
- 新组件需保持与现有卡片相同的视觉风格
- `backdrop-blur-2xl bg-white/70 rounded-[2.5rem]` 等类名需统一

---

## 八、实施步骤

### Step 1：新增 ParseBar 组件
- 从 DownloadCard 提取输入栏逻辑
- 保持相同的样式和交互

### Step 2：新增 VideoPanel 组件
- 封装 VideoPreviewCard + ProgressBar + 操作按钮
- 修改 VideoPreviewCard 去掉"AI总结"按钮

### Step 3：新增 SummaryPanel 组件
- 封装 SSE 总结流逻辑 + Tab 展示
- 修改 SummaryCard 适配新布局

### Step 4：重构 DownloadCard 为布局容器
- 整合 ParseBar + VideoPanel + SummaryPanel
- 实现左右 grid 布局
- 保持所有业务逻辑正确运作

### Step 5：调整 page.tsx
- 扩大主容器宽度
- 验证整体布局效果

### Step 6：测试验证
- 功能测试：解析/下载/总结全流程
- 响应式测试：宽屏/窄屏适配
- 边界测试：无字幕视频、长视频、Playlist等

---

## 九、验收标准

### 9.1 功能验收
- [ ] 输入URL后能正常解析视频信息
- [ ] 解析完成后左栏显示视频预览，右栏自动开始AI总结
- [ ] 右栏SSE流式输出文本总结（带打字机效果）
- [ ] 思维导图正确生成并展示
- [ ] AI对话面板能正常问答
- [ ] 带时间戳字幕能正常展示
- [ ] 左栏下载功能正常
- [ ] 下载进度条正常显示

### 9.2 交互验收
- [ ] 左右布局在宽屏下正常显示
- [ ] 小屏自动降级为上下布局
- [ ] 解析/总结/下载三个流程不互相阻塞
- [ ] Tab切换流畅无闪烁
- [ ] 错误提示清晰友好

### 9.3 代码验收
- [ ] 后端无需任何修改
- [ ] 新组件拆分合理，职责清晰
- [ ] 样式与现有设计一致
- [ ] 无TypeScript编译错误

---

> **文档状态**：方案设计完成，待人工确认后实施
>
> 更新日期：2026-04-26
