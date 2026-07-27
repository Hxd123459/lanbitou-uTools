# 烂笔头 Agent Bridge

本机 HTTP 桥，供待办「Cursor 提取 / 串行执行」使用。

## 启动

插件进入 uTools 后，preload 会自动安装依赖（若缺失）并后台拉起本机桥，默认监听 `127.0.0.1:39281`。

开发调试也可手动执行：

```bash
cd bridge
npm install
npm start
```

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
