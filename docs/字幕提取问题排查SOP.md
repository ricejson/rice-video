# Bilibili 字幕提取问题排查 SOP

## 问题描述

在实现视频 AI 总结功能时，遇到 Bilibili 视频字幕提取失败的问题：

- **现象**：调用 `/api/summarize` 时返回"没有可用字幕"
- **环境**：通过 API 调用 yt-dlp 提取字幕失败，但命令行直接运行 yt-dlp 可以成功获取字幕

---

## 排查过程

### 第一阶段：确认基础连通性

```bash
# 直接用 curl 测试 B 站 API
curl -s 'https://api.bilibili.com/x/web-interface/view?bvid=BV1oWQuBEEZ3'
```

**结果**：API 正常返回数据，网络连通性没有问题。

### 第二阶段：测试命令行 yt-dlp

```bash
# 命令行直接运行 yt-dlp
yt-dlp --cookies-from-browser chrome --list-subs 'https://www.bilibili.com/video/BV1oWQuBEEZ3/'
```

**结果**：成功列出字幕，包含 `ai-zh`、`zh-Hans` 等多个语言选项。

### 第三阶段：测试 Python 脚本中的 yt_dlp

```python
import yt_dlp

url = 'https://www.bilibili.com/video/BV1oWQuBEEZ3/'
ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'cookiesfrombrowser': ('chrome', None, None, None),
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    print('Subtitles:', info.get('subtitles', {}).keys())
```

**结果**：独立脚本执行成功，能够获取字幕。

### 第四阶段：测试 API 环境中的 yt_dlp

```python
# 在 uvicorn 启动的环境中测试
loop.run_in_executor(None, sync_extract)
```

**结果**：返回 HTTP 412 Precondition Failed 错误。

### 第五阶段：检查选项拼写

对比 `downloader.py` 和 `summarizer.py` 中的 yt-dlp 配置：

```python
# downloader.py（正常工作）
'cookiesfrombrowser': ('chrome', None, None, None),

# summarizer.py（失败）
'cookiefrombrowser': ('chrome', None, None, None),  # 拼写错误：少了 's'
```

**发现问题**：`cookiefrombrowser` 少了字母 `s`，正确应该是 `cookiesfrombrowser`

---

## 根本原因

yt-dlp 的选项名称是 `cookiesfrombrowser`（复数），用于从浏览器读取 cookies。

`summarizer.py` 中错误拼写为 `cookiefrombrowser`（单数），导致该选项失效，yt-dlp 无法获取有效的认证 cookies，从而触发 Bilibili 的 412 错误（需要 cookies 才能访问字幕接口）。

---

## 解决方案

### 1. 修复拼写错误

```python
# 错误写法
'cookiefrombrowser': ('chrome', None, None, None),

# 正确写法
'cookiesfrombrowser': ('chrome', None, None, None),
```

### 2. 验证修复

重启后端服务后再次测试，字幕提取成功。

---

## 经验总结

### 为什么命令行和独立脚本能成功？

| 环境 | 是否携带 cookies | 结果 |
|------|-----------------|------|
| 命令行 `yt-dlp --cookies-from-browser chrome` | ✅ 正确读取 | 成功 |
| 独立 Python 脚本（相同配置） | ✅ 正确读取 | 成功 |
| API 环境（拼写错误） | ❌ 选项被忽略 | 412 失败 |

### 调试技巧

1. **排除法**：先确认网络连通性，再测试命令行工具，最后才是代码逻辑
2. **对比配置**：复制一份已知工作的配置，逐字段对比差异
3. **环境差异**：注意 API 服务可能有自己的网络代理配置影响结果

### 常见 yt-dlp 选项拼写

| 选项 | 说明 |
|------|------|
| `--cookies-from-browser` | 从浏览器读取 cookies（注意复数） |
| `--write-subtitles` | 下载字幕文件 |
| `--write-auto-subs` | 下载自动生成的字幕 |
| `--sub-langs` | 指定字幕语言 |

---

## 相关文件

- `app/services/summarizer.py` - 视频总结服务（已修复）
- `app/services/downloader.py` - 参考：正确的 cookiesfrombrowser 用法
- `.env` - ALIYUN_API_KEY 配置

---

## 更新记录

| 日期 | 描述 |
|------|------|
| 2026-04-25 | 初始化文档，记录 412 问题排查过程 |