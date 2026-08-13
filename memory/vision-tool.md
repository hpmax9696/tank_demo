# Vision 识图工具 — vision.py 用法（2026-08-13 固化）

## 用途

当会话模型**无视觉输入能力**时（如 dsh 默认模型 `deepseek-v4-flash` 不支持图像），用 `vision.py`
调用外部多模态模型识图，把描述文字拿回上下文理解。**等价于"视觉 MCP"效果，无需安装任何东西。**

## 位置与依赖

- 脚本：项目根目录 `vision.py`（~120 行，仅标准库 urllib，无第三方依赖）
- API key：`~/.qwen_api_key` 文件（优先）或环境变量 `QWEN_API_KEY`
- 后端：阿里云 dashscope（`https://dashscope.aliyuncs.com/compatible-mode/v1`，OpenAI 兼容）
- 模型：`qwen3.5-omni-flash`（支持图像输入）

## 用法

```powershell
python vision.py <图片路径> [问题]
# 示例
python vision.py screenshots/screenshot-xxx.png "请详细描述这张游戏截图的内容：场景、物体、UI元素"
```

- 不带问题时默认问：`请详细描述这张图片的内容`
- 支持 png/jpg/jpeg/gif/webp/bmp
- 结果（模型文字描述）打印到 stdout；日志（🔍📝🤖）在 stderr；超时 120s
- 只读操作，无副作用，沙箱内可直接运行

## 典型场景（CC 时代已验证）

- 验证游戏渲染：截图后问模型"描述场景/坦克/UI"
- 模型工厂视觉检查（如 S 曲线无破面：`vision.py refs/hexapod/前.png "检查..."`）
- 任何需要"看图"的调试

## 注意

- 识别质量取决于 qwen3.5-omni-flash，中文问答效果良好
- 大图（>2MB）可用但慢，必要时先压缩
- `read_image` 工具当前不可用（模型不支持图像输入），识图一律走 vision.py
- 2026-08-13 实测：`screenshots/screenshot-1785721303874.png` 识别成功（低多边形战场/坦克/小屋/地形描述准确）
