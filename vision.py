#!/usr/bin/env python3
"""
多模态模型调用工具 — 用于识图场景
当 Claude（DeepSeek V4 Pro）无法直接看图时，通过此脚本调用 Qwen3.5-Omni-Flash
"""
import base64
import json
import sys
import os
from pathlib import Path

# 修复 Windows 终端 GBK 编码问题
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import urllib.request
import urllib.error

# === 配置 ===
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL = "qwen3.5-omni-flash"

def _load_api_key():
    """加载 API Key：优先从 ~/.qwen_api_key 文件读取，其次环境变量"""
    key_file = Path.home() / ".qwen_api_key"
    if key_file.exists():
        return key_file.read_text("utf-8").strip()
    env_key = os.environ.get("QWEN_API_KEY", "")
    if env_key:
        return env_key
    print("❌ 未找到 API Key。请创建 ~/.qwen_api_key 文件或设置 QWEN_API_KEY 环境变量", file=sys.stderr)
    sys.exit(1)

API_KEY = _load_api_key()


def image_to_base64(image_path: str) -> tuple[str, str]:
    path = Path(image_path)
    if not path.exists():
        print(f"❌ 文件不存在: {image_path}", file=sys.stderr)
        sys.exit(1)

    ext = path.suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
    }
    mime_type = mime_map.get(ext, "image/png")

    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8"), mime_type


def call_vision(image_path: str, question: str) -> str:
    b64_data, mime_type = image_to_base64(image_path)
    data_url = f"data:{mime_type};base64,{b64_data}"

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": question},
                ],
            }
        ],
        "max_tokens": 2000,
    }

    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"❌ HTTP {e.code}: {error_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"❌ 网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except (KeyError, json.JSONDecodeError) as e:
        print(f"❌ 解析响应失败: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("用法: python vision.py <图片路径> [问题]", file=sys.stderr)
        print("示例: python vision.py screenshot.png '这张图里有什么？'", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    question = sys.argv[2] if len(sys.argv) > 2 else "请详细描述这张图片的内容"

    print(f"🔍 正在识别: {image_path}", file=sys.stderr)
    print(f"📝 问题: {question}", file=sys.stderr)
    print(f"🤖 模型: {MODEL}", file=sys.stderr)
    print("-" * 50, file=sys.stderr)

    result = call_vision(image_path, question)
    print(result)


if __name__ == "__main__":
    main()
