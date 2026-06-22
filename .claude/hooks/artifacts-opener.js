/**
 * Artifacts 自动打开钩子
 *
 * 检测 artifacts/ 目录下新建/修改的 HTML 文件
 * → debounce 2 秒（收集批量写入）
 * → 自动在 Chrome 中打开 http://127.0.0.1:8080/artifacts/<file>
 *
 * v2: 改用 data 事件即时解析（不依赖 stdin end，兼容 harness 不关管道）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts');
const STAMP_FILE = path.join(__dirname, '..', '.artifacts-stamp');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:8080';
const DEBOUNCE_MS = 2000;

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

    const absPath = path.resolve(filePath);
    if (!absPath.startsWith(ARTIFACTS_DIR)) { process.exit(0); return; }
    if (!absPath.endsWith('.html')) { process.exit(0); return; }

    const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const now = Date.now();
    fs.writeFileSync(STAMP_FILE, String(now) + '\n' + rel);

    // 后台 debounce：等 DEBOUNCE_MS 后检查
    const child = spawn(
      'node',
      [
        '-e',
        `
        const fs = require('fs');
        const { spawn } = require('child_process');
        const stamp = ${now};
        const stampFile = ${JSON.stringify(STAMP_FILE)};
        const baseUrl = ${JSON.stringify(BASE_URL)};
        const chrome = ${JSON.stringify(CHROME)};
        const delay = ${DEBOUNCE_MS};

        setTimeout(() => {
          try {
            const content = fs.readFileSync(stampFile, 'utf8').trim();
            const lines = content.split('\\n');
            const currentStamp = parseInt(lines[0]);
            if (currentStamp !== stamp) return;

            const relPath = lines[1];
            if (!relPath) return;

            const url = baseUrl + '/' + relPath;
            const p = spawn(chrome, [url], {
              stdio: 'ignore',
              detached: true,
            });
            p.unref();
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
