#!/bin/bash

# 万能视频下载器启动脚本

set -e

echo "=== 万能视频下载器 ==="

# 检查 Python 依赖
echo "检查 Python 依赖..."
if ! pip3 show fastapi > /dev/null 2>&1; then
    echo "安装 Python 依赖..."
    pip3 install -r requirements.txt
fi

# 检查 Node.js 依赖
echo "检查 Node.js 依赖..."
if [ ! -d "web/node_modules" ]; then
    echo "安装 Node.js 依赖..."
    cd web && npm install && cd ..
fi

# 创建下载目录
mkdir -p downloads

# 启动后端
echo "启动后端服务 (http://localhost:8000)..."
cd "$(dirname "$0")"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端
echo "启动前端服务 (http://localhost:3000)..."
cd web && npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务已启动 ==="
echo "后端 API: http://localhost:8000"
echo "前端界面: http://localhost:3000"
echo "API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待信号
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
