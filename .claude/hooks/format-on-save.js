/**
 * PostToolUse hook — 每次 Write/Edit 后自动格式化文件。
 * 读取 stdin JSON → 提取 file_path → prettier --write
 *
 * v2: 改用 data 事件即时解析（不依赖 stdin end，兼容 harness 不关管道）
 */
const { execSync } = require('child_process');
const path = require('path');

const FORMAT_EXTENSIONS = /\.(js|html|css|json|md)$/i;

let input = '';
let done = false;
process.stdin.on('data', (chunk) => {
  if (done) return;
  input += chunk;
  try {
    const event = JSON.parse(input);
    done = true;

    const filePath = event.tool_input?.file_path;
    if (!filePath) { process.exit(0); return; }
    if (!FORMAT_EXTENSIONS.test(filePath)) { process.exit(0); return; }

    const start = Date.now();
    try {
      const result = execSync(`npx prettier --write "${filePath}"`, {
        cwd: path.resolve(__dirname, '..', '..'),
        stdio: 'pipe',
        timeout: 15000,
      });
      const elapsed = Date.now() - start;
      const output = result.toString().trim();
      if (output) process.stderr.write(`[prettier] ${output} (${elapsed}ms)\n`);
    } catch (e) {
      const msg = (e.stderr || e.stdout || '').toString().trim();
      if (msg) process.stderr.write(`[prettier] FAIL:\n${msg}\n`);
    }
  } catch (_) {
    // JSON 还没收完，等下一块
  }
});
setTimeout(() => { if (!done) process.exit(0); }, 100);
