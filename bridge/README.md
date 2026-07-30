# 烂笔头 Agent Bridge

本机 HTTP 桥，供待办「Cursor 提取 / 串行执行」使用。

## 启动

Agent 桥为**常驻服务**，插件不会自动拉起。

推荐（Windows）：事情页点「启动」（任务栏会出现 **一个** 最小化窗口），或双击 `start-resident.cmd`。

已在线时不会再开第二个窗口。关闭该窗口即停止服务。

开发调试：

```bash
cd bridge
npm install
npm start
```

默认监听 `127.0.0.1:39281`。

## 环境变量

- `CURSOR_API_KEY`：Cursor API Key（也可由前端请求头 `x-cursor-api-key` 传入）
- `LANBITOU_AGENT_BRIDGE_PORT`：端口，默认 `39281`

## 接口

- `GET /health`
- `POST /extract` `{ cwd, notes, provider? }`
- `POST /run` `{ cwd, todoId, prompt, provider? }`
- `GET /run/:id`
- `POST /run/:id/cancel`

当前仅 `provider=cursor` 可用；`claude` / `codex` 为占位。
