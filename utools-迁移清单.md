# 烂笔头 · uTools 本地存储迁移清单

> 目标：将现后端（PostgreSQL + MinIO + Java）中的数据能力，迁移到 [uTools 本地数据库](https://www.u-tools.cn/docs/developer/utools-api/db.html)（`utools.db` / `postAttachment`）。
>
> 架构方向：前端增加 **storage 抽象层**，uTools 环境走 `UtoolsAdapter`，Web 环境可保留 `HttpAdapter`。

---

## 汇总

| 类别 | 数量 | 说明 |
|------|------|------|
| ✅ 可完整迁移 | 32 项 | 笔记、标签、回收站、沉淀、图片、热力图等 |
| ❌ 无法完整迁移 | 7 项 | 语义搜索、AI 加工、回响、问答等 |
| ⚠️ 可降级替代 | 6 项 | 有备选方案，体验打折 |

**一句话：** 「记、存、搜（关键词）、整理、沉淀、回收」可迁；「AI 懂你」相关只能砍、降级或另接 AI 服务。

---

## 一、可完整迁移（32 项）

以下功能**不依赖 AI、不依赖向量、不依赖 MinIO**，迁到 `utools.db` 后用户体验可与现在基本一致。

### 1. 碎片笔记（主页核心）

| # | 功能 | 现 API | 本地存储方式 |
|---|------|--------|-------------|
| 1 | 新建笔记（纯文本） | `POST /api/note/insert` | `lanbitou/note/{id}` doc |
| 2 | 新建笔记（含图片） | `multipart insert` | doc + `postAttachment` 存图 |
| 3 | 编辑笔记（文本） | `POST /api/note/update` | `db.put` 更新 doc |
| 4 | 编辑笔记（增删图片） | `multipart update` | 更新 doc + attachment 增删 |
| 5 | 删除笔记（进回收站） | `GET /api/note/delete` | doc 加 `deletedAt` |
| 6 | 按日期分页列表 | `POST /api/note/listByDay` | `allDocs("lanbitou/note/")` + 前端按日期过滤分页 |
| 7 | 关键词搜索 | `GET /api/note/search` | 本地匹配 title / summary / raw / markdown |
| 8 | 按标签筛选列表 | `listByDay + tagId` | 本地按 `tagId` 过滤 |
| 9 | 置顶 / 置底 | `POST /api/note/setPin` | doc 改 `pinWeight` |
| 10 | 笔记卡片展示字段 | — | id、title、summary、markdown、createTime、images、pinWeight |

**涉及文件：** `src/api/note.js`、`src/stores/assistantStore.js`、`src/views/HomeView.vue`、`src/components/note/NoteCard.vue`、`src/components/input/FloatingInputBar.vue`

---

### 2. 标签

| # | 功能 | 现 API | 本地存储方式 |
|---|------|--------|-------------|
| 11 | 标签云列表 | `GET /api/note/allTags` | 从笔记聚合，或 `lanbitou/tag/{id}` 独立存 |
| 12 | 点击标签筛选 | `fetchNotesByTag` | 本地过滤 |

**涉及文件：** `src/api/note.js`、`src/components/note/NoteTagCloud.vue`、`src/views/HomeView.vue`

---

### 3. 回收站

| # | 功能 | 现 API | 本地存储方式 |
|---|------|--------|-------------|
| 13 | 回收站列表 | `GET /api/note/recycle/list` | 筛 `deletedAt != null` |
| 14 | 恢复笔记 | `GET /api/note/recycle/restore` | 清空 `deletedAt` |
| 15 | 彻底删除 | `GET /api/note/recycle/deleteForever` | `db.remove` + 删 attachment |

**涉及文件：** `src/api/note.js`、`src/components/trash/TrashPanel.vue`

---

### 4. 沉淀（文件夹 + 结构化笔记）

| # | 功能 | 现 API | 本地存储方式 |
|---|------|--------|-------------|
| 16 | 文件夹列表 | `GET /struct/folder/list/{parentId}` | `lanbitou/struct/folder/{id}` |
| 17 | 新建文件夹 | `POST /struct/folder/createFolder` | `db.put` |
| 18 | 文件夹内新建笔记 | `POST /struct/folder/createNoteInFolder` | folder doc + struct note doc |
| 19 | 重命名 | `POST /struct/folder/rename` | `db.put` |
| 20 | 移动节点 | `POST /struct/folder/move` | 改 `parentId` |
| 21 | 删除节点 | `GET /struct/folder/delete/{id}` | `db.remove`（递归删子节点） |
| 22 | 拖拽排序 | `POST /struct/folder/updateSort` | 批量改 `sort` |
| 23 | 结构化笔记详情 | `GET /struct/note/get/{id}` | `lanbitou/struct/note/{id}` |
| 24 | 创建 / 更新结构化笔记 | `POST /struct/note/create` \| `update` | `db.put` |
| 25 | 删除结构化笔记 | `GET /struct/note/delete/{id}` | `db.remove` |

**涉及文件：** `src/api/structFolder.js`、`src/api/structNote.js`、`src/components/sediment/SedimentPanel.vue`、`src/components/sediment/StructNoteViewModal.vue`、`src/components/sediment/StructNoteCreateModal.vue`

---

### 5. 纯前端已有（迁移后数据源改为本地库即可）

| # | 功能 | 说明 |
|---|------|------|
| 26 | 写作热力图 | 已从 `assistantStore.notes` 计算，不直接调 API |
| 27 | 复制笔记 | `useCopyNote`，纯前端 |
| 28 | 批量选择 / 批量删除 | 复用 delete 逻辑 |
| 29 | Markdown 编辑预览 | ByteMD 纯前端 |
| 30 | uTools 多设备同步 | 用户开启 uTools 数据同步后，db 自动备份（平台能力） |

---

### 6. 图片存储（可行，实现方式变更）

| # | 现方案 | 迁移方案 | 注意 |
|---|--------|---------|------|
| 31 | MinIO + `/api/note/file/{blockId}` 302 | `postAttachment` + `Blob URL` 预览 | 单图 ≤ 10MB |
| 32 | 多图排序 `sortOrder` | attachment id 列表 + sort 字段 | 完全可行 |

---

### 迁移后可移除的后端依赖（针对上述 32 项）

| 组件 | 说明 |
|------|------|
| PostgreSQL | 笔记 / 文件夹 / 标签全进 utools.db |
| MinIO | 图片改 attachment |
| Java 后端（上述功能部分） | 上述 32 项均不经过 HTTP |

---

## 二、本地数据模型（草案）

```text
lanbitou/note/{id}              # 单条碎片笔记
lanbitou/note-index               # 索引元数据（可选）
lanbitou/tag/{id}                 # 标签（或嵌在 note 里）
lanbitou/struct/folder/{id}      # 沉淀文件夹节点
lanbitou/struct/note/{id}        # 结构化笔记正文
lanbitou/att/note/{noteId}/{imageId}   # 图片附件（postAttachment）
```

**单条 note doc 示例：**

```json
{
  "_id": "lanbitou/note/abc123",
  "rawContent": "原始输入",
  "markdownContent": "格式化内容",
  "title": "标题",
  "summary": "摘要",
  "createTime": "2026-06-05T10:00:00",
  "pinWeight": 0,
  "tagId": null,
  "imageIds": ["img1", "img2"],
  "deletedAt": null
}
```

**uTools 限制：**

- 单文档 ≤ **1MB**（正文放 doc，图片走 attachment）
- 单附件 ≤ **10MB**
- 多设备同时改同一 doc 可能冲突 → **一条笔记一个 `_id`**

---

## 三、无法完整迁移（7 项）

| # | 功能 | 现 API | 原因 |
|---|------|--------|------|
| ❌ 1 | 语义搜索（侧栏「给我一个想法」） | `POST /api/semantic/text` | 依赖百炼 embedding + pgvector |
| ❌ 2 | 图片语义搜索（以图搜图） | `POST /api/semantic/image` | 多模态向量检索 |
| ❌ 3 | AI 自动打标题 / 摘要 / Markdown 格式化 | insert 时后端调通义千问 | 需大模型 |
| ❌ 4 | 笔记向量化（embedding 入库） | 后端 `NoteEmbeddingService` | 1152 维向量 + DB 检索 |
| ❌ 5 | 人生回响 | `GET /note/memory/recall` | 依赖 embedding 召回 + AI 生成 |
| ❌ 6 | 回响点击统计 | `GET /note/memory/click` | 依附回响体系 |
| ❌ 7 | AI 问答（流式聊天） | `GET /api/chat/stream` | 后端有，前端未接 |

**涉及文件：** `src/api/semantic.js`、`src/components/search/SemanticSearchModal.vue`、`src/api/noteMemory.js`、`src/components/note/NoteRecallModal.vue`、`src/components/note/NoteCard.vue`

---

## 四、可降级替代（6 项）

| # | 功能 | 降级方案 | 体验差异 |
|---|------|---------|---------|
| ⚠️ 1 | 语义搜索 | 改成本地关键词 / 模糊搜索 | 无「理解语义」 |
| ⚠️ 2 | AI 标题 / 摘要 | `title = 正文前 N 字`，`summary` 留空 | 无智能分类 |
| ⚠️ 3 | Markdown 格式化 | `markdownContent = rawContent` | 无 AI 排版 |
| ⚠️ 4 | 人生回响 | 按日期查「N 天前的笔记」 | 有回忆感，无 AI 文案 |
| ⚠️ 5 | `fineTitle` / `tokenUsage` | 字段留空或去掉展示 | 几乎无感 |
| ⚠️ 6 | `moveBlocksToSediment` | API 有、UI 未用；本地可实现搬运 | 需单独开发 |

---

## 五、待决策项

| 项 | 说明 |
|----|------|
| 双模式 | Web 版是否继续走后端？还是 uTools 专版纯本地？ |
| 旧数据导入 | PostgreSQL → utools.db 需一次性导入脚本 |
| AI 阶段 | 砍掉 / 降级 / uTools AI API / 用户自填 Key / 保留极简后端 |
| 数据量 | 笔记极多时控制单 doc 体积，图片一律走 attachment |

---

## 六、建议实施顺序

1. **阶段 1**：storage 抽象层 + 32 项完整迁移（纯本地可用）
2. **阶段 2**：导出 / 导入 JSON、旧数据迁移、回响降级
3. **阶段 3**（可选）：AI 能力选型与接入

---

*最后更新：2026-06-05*
