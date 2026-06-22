/**
 * Notification hook → Windows 托盘气泡
 * 读取 stdin JSON → 提取通知类型 → 调用 PowerShell 弹窗
 *
 * v2: 改用 data 事件即时解析（不依赖 stdin end，兼容 harness 不关管道）
 */
const { spawn } = require('child_process');
const path = require('path');

const PS_SCRIPT = path.resolve(__dirname, 'notify.ps1');

let input = '';
let done = false;
process.stdin.on('data', (chunk) => {
  if (done) return;
  input += chunk;
  try {
    const event = JSON.parse(input);
    done = true;

    let title = 'Claude Code';
    let message = '需要你的确认';

    if (event.notification_type === 'permission' || event.tool_name) {
      const tool = event.tool_name || '';
      if (tool) {
        message = '请求执行: ' + tool;
      }
    }

    if (event.message) {
      message = event.message.substring(0, 200);
    }

    const ps = spawn(
      'powershell',
      [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        PS_SCRIPT,
        title,
        message,
      ],
      {
        stdio: 'ignore',
        detached: true,
      }
    );
    ps.unref();
  } catch (_) {
    // JSON 还没收完，等下一块
  }
});
setTimeout(() => { if (!done) process.exit(0); }, 100);
