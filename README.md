# 万能视频下载器

一款轻量级多平台视频下载工具，支持 1700+ 平台。

## 功能特性

- 视频下载 - 支持 YouTube、Bilibili、抖音等 1700+ 平台
- 字幕下载 - 下载原始字幕或自动翻译
- AI 总结 - 智能提取视频内容摘要
- 多清晰度 - 支持 720p、1080p、4K

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+
- FFmpeg

### 安装依赖

```bash
# 安装 Python 依赖
pip3 install -r requirements.txt

# 安装 Node.js 依赖
cd web && npm install && cd ..
```

### 启动服务

```bash
# 一键启动（后端 + 前端）
./start.sh

# 或手动启动
# 终端 1: 启动后端
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 终端 2: 启动前端
cd web && npm run dev
```

### 访问服务

- 前端界面: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 技术栈

- **前端**: Next.js + Tailwind CSS
- **后端**: Python FastAPI
- **视频处理**: yt-dlp + FFmpeg

## 项目结构

```
rice-video/
├── app/                    # Python 后端
│   ├── main.py            # FastAPI 入口
│   ├── api/               # API 路由
│   ├── services/          # 业务服务
│   ├── models/            # 数据模型
│   └── core/              # 核心配置
├── web/                    # Next.js 前端
│   ├── src/
│   │   ├── app/          # 页面
│   │   └── components/    # 组件
│   └── ...
├── downloads/              # 下载文件目录
├── requirements.txt        # Python 依赖
└── start.sh               # 启动脚本
```

## 开发说明

### Phase 1 (当前)
- [x] 项目初始化
- [x] 视频下载核心功能
- [x] 进度实时推送
- [ ] 联调测试

### Phase 2
- [ ] 字幕下载
- [ ] 字幕翻译
- [ ] 字幕烧录

### Phase 3
- [ ] AI 视频总结

### Phase 4
- [ ] 订阅系统
- [ ] 支付集成

## License

MIT
