# 烂笔头 Agent Bridge

本机 HTTP 桥，供待办「Cursor 提取 / 串行执行」使用。

## 启动

```bash
cd bridge
npm install
npm start
```

默认监听 `127.0.0.1:39281`。

也可在设置中填写 Cursor API Key 后，由 uTools preload 自动尝试拉起（需本机能执行 `node`）。

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
