/**
 * PostToolUse debounce — 检测 Claude 是否"停下来了"
 *
 * 原理：
 *   每次工具调用后写入时间戳 → 后台等 4 秒
 *   → 如果 4 秒内没有新工具调用（时间戳没变）= Claude 已完成回复、在等你输入
 *   → 弹出 Windows 托盘通知
 *
 * v2: 改用 data 事件即时解析（不依赖 stdin end，兼容 harness 不关管道）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const STAMP_FILE = path.resolve(__dirname, '..', '.last-tool-ts');
const PS_SCRIPT = path.resolve(__dirname, 'notify.ps1');
const DEBOUNCE_MS = 4000;

let input = '';
let done = false;
process.stdin.on('data', (chunk) => {
  if (done) return;
  input += chunk;
  try {
    JSON.parse(input);
    done = true;
    const now = Date.now();
    fs.writeFileSync(STAMP_FILE, String(now));

    // 后台子进程：等 DEBOUNCE_MS 后检查时间戳是否被更新
    const child = spawn(
      'node',
      [
        '-e',
        `
        const fs = require('fs');
        const { spawn } = require('child_process');
        const stamp = ${now};
        const file = ${JSON.stringify(STAMP_FILE)};
        const ps = ${JSON.stringify(PS_SCRIPT)};
        const delay = ${DEBOUNCE_MS};
        setTimeout(() => {
          try {
            const current = fs.readFileSync(file, 'utf8').trim();
            if (current === String(stamp)) {
              const p = spawn('powershell', [
                '-ExecutionPolicy', 'Bypass', '-File', ps,
                'Claude Code',
                '任务完成，等你下一步指令',
              ], { stdio: 'ignore', detached: true });
              p.unref();
            }
          } catch (_) {}
        }, delay);
      `,
      ],
      { stdio: 'ignore', detached: true }
    );
    child.unref();
  } catch (_) {
    // JSON 还没收完，等下一块
  }
});
// 兜底：100ms 后若还没收到完整 JSON 就退出
setTimeout(() => { if (!done) process.exit(0); }, 100);
