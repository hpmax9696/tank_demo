# API 用量桌面监控插件 — 设计方案

> 状态：设计完成，待实现 | 日期：2026-06-18

## 目标

一个始终置顶的桌面小窗口，实时显示：
1. **DeepSeek 账户余额**（总余额 / 充值余额 / 赠送余额）
2. **智谱 Coding Plan 用量**（5小时 Token 百分比 / 周用量百分比）

---

## 一、数据源

| 数据 | API 端点 | 认证方式 |
|------|----------|----------|
| DeepSeek 余额 | `GET https://api.deepseek.com/user/balance` | `Authorization: Bearer <key>` |
| 智谱用量 | `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit` | `Authorization: <key>` |

### DeepSeek 响应格式

```json
{
  "is_available": true,
  "balance_infos": [{
    "currency": "CNY",
    "total_balance": "110.00",
    "granted_balance": "10.00",
    "topped_up_balance": "100.00"
  }]
}
```

### 智谱响应格式

```json
{
  "limits": [
    { "type": "Token usage(5 Hour)", "percentage": 45 },
    { "type": "MCP usage(1 Month)", "percentage": 23 }
  ]
}
```

### 待确认

- [ ] 智谱用量：用同一个 key 还是独立 key？
- [ ] 智谱 API 基地址：`open.bigmodel.cn`（直连智谱）还是 `api.z.ai`（Z.AI 平台）？

---

## 二、技术选型

### 推荐方案：Python + tkinter（内置，零依赖）

| 对比维度 | tkinter ✅ | Electron | PyQt | pywebview |
|----------|-----------|----------|------|-----------|
| 安装依赖 | 无（Python 自带） | ~200MB | `pip install` | `pip install` |
| 置顶支持 | 原生 `-topmost` | 原生 | 原生 | 原生 |
| UI 美观度 | ★★☆ | ★★★ | ★★★ | ★★★ |
| 内存占用 | ~15MB | ~150MB | ~40MB | ~50MB |
| 开发量 | ~300 行 | ~500 行 | ~400 行 | ~350 行 |

**备选方案**：如果对 UI 有更高要求，可以后续升级为 `pywebview`（HTML/CSS UI + Python 后端）。

### 不选 Electron 的理由

桌面监控插件追求轻量长驻，Electron 的 Chromium 运行时太重（内存 150MB+），不适合一直挂着。

---

## 三、UI 设计（暗色主题，约 280×200px）

```
┌──────────────────────────────┐
│  📊  用量监控       _  □  X  │
├──────────────────────────────┤
│                              │
│  🔵 DeepSeek 余额            │
│  ┌──────────────────────┐    │
│  │ 总余额       ¥110.00 │    │
│  │ 充值余额     ¥100.00 │    │
│  │ 赠送余额      ¥10.00 │    │
│  └──────────────────────┘    │
│                              │
│  🟣 智谱 Coding Plan         │
│  ┌──────────────────────┐    │
│  │ 5h Token   ████░░ 45%│    │
│  │ 周用量     ██░░░  23%│    │
│  └──────────────────────┘    │
│                              │
│  更新于 14:30:25   [🔄 刷新] │
└──────────────────────────────┘
```

### 交互特性

| 特性 | 说明 |
|------|------|
| **始终置顶** | `window.attributes('-topmost', True)` |
| **拖拽移动** | 鼠标按住窗口任意位置可拖动 |
| **自动刷新** | 每 60 秒轮询一次 API |
| **手动刷新** | 按钮点击 / 双击窗口 |
| **颜色告警** | 余额 < ¥10 → 红色高亮；用量 > 80% → 橙色警告 |
| **窗口缩放** | 鼠标滚轮调节透明度（0.3~1.0） |
| **最小化到托盘**（可选） | 关闭按钮 → 收进系统托盘，右键退出 |
| **开机自启**（可选） | 快捷方式放入 `shell:startup` |

---

## 四、文件结构

```
C:\Users\hpmax\tools\api_monitor\
├── api_monitor.py       # 主程序（约 300 行）
├── config.json          # 配置文件（API key + 偏好设置）
└── run_monitor.bat      # 双击启动脚本
```

### `config.json` 示例

```json
{
  "deepseek": {
    "api_key": "<你的DeepSeek API Key>",
    "base_url": "https://api.deepseek.com"
  },
  "zhipu": {
    "api_key": "<你的智谱/ZAI API Key>",
    "base_url": "https://open.bigmodel.cn"
  },
  "refresh_interval_sec": 60,
  "opacity": 0.9,
  "alert_balance_cny": 10,
  "alert_usage_pct": 80
}
```

---

## 五、核心代码架构

```python
# api_monitor.py 结构概览

import tkinter as tk
from tkinter import ttk
import json, threading, time, urllib.request

class APIFetcher:
    """负责 HTTP 请求，查询 DeepSeek / 智谱 API"""
    def fetch_deepseek_balance() -> dict | None
    def fetch_zhipu_usage() -> dict | None
    def refresh_all() -> dict          # 线程池并行请求两个 API

class MonitorWidget:
    """tkinter 主窗口：UI 渲染 + 定时刷新"""
    def __init__(config)               # 创建置顶窗口 + ttk 布局
    def build_ui()                     # 构建 Label/ProgressBar 控件
    def update_display(data)           # 刷新数据 + 颜色状态
    def start_auto_refresh()           # 60 秒定时器（threading.Timer）
    def on_manual_refresh()            # 按钮回调
    def on_drag_start / on_drag_move() # 窗口拖拽
    def save_position()                # 记住窗口位置到 config

def main():
    config = json.load(open('config.json'))
    widget = MonitorWidget(config)
    widget.start_auto_refresh()
    widget.mainloop()
```

### API 请求细节

```python
# DeepSeek 余额查询
def fetch_deepseek_balance(api_key):
    req = urllib.request.Request(
        "https://api.deepseek.com/user/balance",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data["balance_infos"][0]  # {total_balance, granted_balance, topped_up_balance}

# 智谱用量查询
def fetch_zhipu_usage(api_key, base_url):
    now = datetime.now()
    start = (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    end = now.strftime("%Y-%m-%d %H:%M:%S")
    url = f"{base_url}/api/monitor/usage/quota/limit?startTime={start}&endTime={end}"
    req = urllib.request.Request(url, headers={"Authorization": api_key})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data["data"]["limits"]  # [{type, percentage}, ...]
```

---

## 六、后续可扩展方向

1. **多模型费用统计**：解析智谱 `model-usage` API，按模型分开展示 token 消耗
2. **历史曲线图**：用 matplotlib 画最近 24h 用量走势
3. **桌面通知**：余额不足 / 用量超标时 Windows toast 弹窗
4. **键盘快捷键**：全局热键 `Ctrl+Shift+M` 显示/隐藏窗口
5. **双平台合并视图**：如果同时用 DeepSeek + 智谱 + Claude，统一显示

---

## 七、待确认事项

| # | 问题 | 影响 |
|---|------|------|
| 1 | 智谱用量用同一个 key 还是独立 key？ | 决定 `config.json` 中 key 数量 |
| 2 | 智谱 API 是 `open.bigmodel.cn` 还是 `api.z.ai`？ | 决定 API 基地址 |
| 3 | 偏好 tkinter（零依赖）还是 pywebview（更美观）？ | 决定实现方案 |
| 4 | 是否需要系统托盘最小化？ | 决定关闭按钮行为 |
| 5 | 是否需要开机自启？ | 是否创建 startup 快捷方式 |

---

## 八、实现步骤（确认后执行）

1. 创建 `C:\Users\hpmax\tools\api_monitor\` 目录
2. 编写 `api_monitor.py`（约 300 行）
3. 编写 `config.json`（用户填入 key）
4. 编写 `run_monitor.bat` 启动脚本
5. 本地测试验证
6. 可选：创建 `shell:startup` 快捷方式
