# Task Statistics Page Overrides

> **PROJECT:** AI Workspace
> **Generated:** 2026-07-30 16:58:49
> **Page Type:** Dashboard / Data View
> **Implementation Target:** `ProjectDetailView.vue`（`showStats` 视图）

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/ai-workspace/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page Layout Structure

任务统计页嵌入项目详情面板，切换自待办列表（`showStats = true`）。自上而下分三区：

```
┌─────────────────────────────────────────────┐
│  Header（保留项目详情顶栏，含「返回待办列表」）  │
├─────────────────────────────────────────────┤
│  KPI 区 — 3 列指标卡片（Token / 时间 / 费用）   │
├─────────────────────────────────────────────┤
│  柱状图区 — 按任务/时间维度的对比柱状图         │
├─────────────────────────────────────────────┤
│  Footer Hint — 费用估算说明（12px 次要文字）    │
└─────────────────────────────────────────────┘
```

### Layout Overrides

- **Container:** 继承 `.project-detail-pane`，`flex-direction: column`，`gap: var(--space-md)`（16px）
- **Max Width:** 随父容器 100%，不设独立 max-width
- **KPI Grid:** 桌面端 3 列等宽（`grid-template-columns: repeat(3, 1fr)`）；≤768px 单列堆叠
- **Chart Area:** KPI 区下方，占剩余高度（`flex: 1 1 auto; min-height: 240px`）
- **Section Order:** Header → KPI Cards → Bar Chart → Hint Text

---

## KPI 区（Key Performance Indicators）

| 指标 | 标签 | 数据字段 | 说明 |
|------|------|----------|------|
| 1 | 总 Token | `runMetricsDisplay.tokens` | 等宽数字 `tabular-nums`，右对齐 |
| 2 | 总时间 | `runMetricsDisplay.duration` | 人类可读时长 |
| 3 | 约合费用 | `runMetricsDisplay.cost` | 强调色，参考 Cursor 单价 |

### KPI 卡片样式

```css
.stats-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);           /* 8px */
  padding: var(--space-xs) var(--space-xs) 0;  /* 4px top */
}

.stats-kpi-card {
  background: var(--color-background, #F8FAFC);
  border: 1px solid rgba(30, 64, 175, 0.10);   /* Primary @ 10% */
  border-radius: 10px;
  padding: var(--space-md) var(--space-md);     /* 16px */
  box-shadow: var(--shadow-sm);
  transition: box-shadow 200ms ease;
}

.stats-kpi-label {
  font-size: 12px;
  color: var(--color-secondary-text, #475569);
  margin-bottom: var(--space-xs);               /* 4px */
}

.stats-kpi-value {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text, #1E3A8A);
}

.stats-kpi-value--accent {
  color: var(--color-cta, #F59E0B);             /* 费用指标 */
}
```

### KPI 间距

| 元素 | Token | 值 |
|------|-------|-----|
| 卡片间距 | `--space-sm` | 8px |
| 卡片内边距 | `--space-md` | 16px |
| 标签与数值间距 | `--space-xs` | 4px |
| KPI 区与柱状图区间距 | `--space-md` | 16px |

---

## 柱状图区（Bar Chart Area）

基于 SKILL chart 域检索：**Compare Categories → Bar Chart (Horizontal or Vertical)**

### 图表规格

| 属性 | 规范 |
|------|------|
| 类型 | 垂直柱状图（任务 Token/时长对比）；备选水平柱状图（任务名较长时） |
| 库 | Chart.js / Recharts（Vue 可用 vue-chartjs） |
| 交互 | Hover 显示 tooltip；可选点击排序（降序） |
| 无障碍 | 柱顶/柱旁显示数值标签；不依赖颜色作为唯一信息载体 |

### 柱状图配色

| 元素 | Hex | CSS Variable | 用途 |
|------|-----|--------------|------|
| 柱体主色 | `#3B82F6` | `--color-secondary` | 默认柱 |
| 柱体强调 | `#1E40AF` | `--color-primary` | 最高值 / 当前选中任务 |
| 柱体高亮 | `#F59E0B` | `--color-cta` | Hover / 活跃任务 |
| 网格线 | `rgba(30, 58, 138, 0.08)` | — | Y 轴参考线 |
| 轴标签 | `#475569` | — | 12px 次要文字 |
| 图表背景 | `#FFFFFF` | — | 卡片内白底 |

### 柱状图容器

```css
.stats-chart-area {
  flex: 1 1 auto;
  min-height: 240px;
  padding: var(--space-md);                       /* 16px */
  background: #FFFFFF;
  border: 1px solid rgba(30, 64, 175, 0.10);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
}

.stats-chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #1E3A8A);
  margin-bottom: var(--space-sm);                 /* 8px */
}
```

### 柱状图间距

| 元素 | Token | 值 |
|------|-------|-----|
| 容器内边距 | `--space-md` | 16px |
| 标题与图表间距 | `--space-sm` | 8px |
| 柱间间距（categoryPercentage） | — | 0.6（约 40% 间隙） |
| 图表区与 Hint 间距 | `--space-md` | 16px |

---

## Spacing Overrides

- **Content Density:** 中等 — KPI 紧凑、图表区留足可视高度
- **Pane Padding:** `8px 4px 12px`（与现有 `.project-detail-stats` 对齐）
- **Section Gap:** `--space-md`（16px）统一垂直节奏
- **Mobile (≤768px):** KPI 单列，`gap: var(--space-sm)`；图表 `min-height: 200px`

---

## Color Overrides

沿用 Master 调色板，任务统计页专用映射：

| 语义 | Hex | 用途 |
|------|-----|------|
| Primary `#1E40AF` | 标题、最高柱、边框强调 |
| Secondary `#3B82F6` | 默认柱体、链接 |
| CTA `#F59E0B` | 费用 KPI、Hover 高亮 |
| Background `#F8FAFC` | KPI 卡片底、页面底 |
| Text `#1E3A8A` | 主文字、数值 |
| Muted `#475569` | 标签、Hint、轴文字 |
| Border | `rgba(30, 64, 175, 0.10)` | 卡片/图表容器边框 |

---

## Component Overrides

- KPI 卡片替代现有 `.project-detail-stats-breakdown` 列表布局
- 柱状图区为新增组件，置于 KPI 与 Hint 之间
- Hint 保留：`.project-detail-stats-hint`，12px，`--color-secondary-text`

---

## Page-Specific Components

- **StatsKpiGrid** — 3 列 KPI 卡片（Token / 时间 / 费用）
- **StatsBarChart** — 任务维度对比柱状图，支持 hover tooltip + 数值标签
- **StatsHint** — 费用估算免责声明

---

## Recommendations

- Effects: Hover tooltips on bars, row/card highlighting on hover, smooth filter animations (150–300ms)
- 柱体按数值降序排列，便于快速识别 Top 任务
- 实时运行中的任务柱体可使用轻微 pulse 动画（尊重 `prefers-reduced-motion`）
- 空数据态：图表区显示占位文案「暂无执行数据」，保留 KPI 零值展示
- 响应式断点：375px / 768px / 1024px / 1440px（与 Master Checklist 一致）
