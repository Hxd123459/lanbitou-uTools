/**
 * Windows 控制台继承说明：
 *
 * 手动在终端里跑 `node server.js` 时，bridge 自带控制台，
 * Cursor SDK 的 shell/npm 子进程会挂到同一控制台 → 不弹新窗。
 *
 * 若用 windowsHide/CREATE_NO_WINDOW 把 bridge 藏成「无控制台」进程，
 * 每个 shell 工具都会 AllocConsole → 疯狂弹 CMD；
 * 再对子进程强制 windowsHide，还会打断继承，npm 脚本的孙进程照样弹窗且常驻。
 *
 * 因此这里不再改写/强藏 SDK 的 shell；只保留极轻量的诊断开关。
 * 正确做法在 preload：用 conhost --headless 启动 bridge（有会话、无可见窗）。
 */

export function ensureWindowsHideConsole() {
  // 有意 no-op：强藏窗会破坏控制台继承，反而导致弹窗。
  return false
}
