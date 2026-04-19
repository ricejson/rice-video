"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";

interface TaskProgress {
  task_id: string;
  status: string;
  progress: number;
  speed?: string;
  eta?: string;
  title?: string;
  filename?: string;
  error?: string;
}

export default function DownloadCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<TaskProgress | null>(null);
  const [error, setError] = useState("");
  const [downloadDir, setDownloadDir] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("请输入视频链接");
      return;
    }

    setLoading(true);
    setError("");
    setTask(null);

    try {
      // 提交下载任务
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          quality: "best",
          format: "mp4",
          subtitles: false,
          translate: false,
        }),
      });

      const data = await res.json();
      if (data.code !== 0) {
        throw new Error(data.message || "提交任务失败");
      }

      const taskId = data.data.task_id;
      setTask({ task_id: taskId, status: "pending", progress: 0 });

      // 使用轮询方式获取进度
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/download/status/${taskId}`);
          const statusData = await statusRes.json();
          if (statusData.code === 0 && statusData.data) {
            const progress = statusData.data;
            setTask(progress);

            // 下载完成或失败时停止轮询
            if (progress.status === "finished" || progress.status === "failed") {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              setLoading(false);
            }
          }
        } catch (e) {
          console.error("轮询错误:", e);
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || "下载失败");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setLoading(false);
    setTask(null);
  };

  const handleDownloadFile = async () => {
    if (!task?.filename) return;

    // 获取文件URL
    const fileUrl = `/api/download/file/${task.task_id}`;
    // 使用 fetch 下载文件并保存到本地
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error("下载文件失败");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // 创建临时 a 标签触发下载
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = task.filename.split("/").pop() || "video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-10 border border-white/20">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">视频下载</h2>
            <p className="text-gray-500">支持 1700+ 平台，一键下载</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="粘贴视频链接，如 https://www.bilibili.com/video/BVxxx"
                className="w-full px-6 py-4 bg-gray-50/80 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none text-gray-700 placeholder-gray-400"
                disabled={loading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                {url && (
                  <button
                    onClick={() => setUrl("")}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            {task && (
              <div className="space-y-4 p-6 bg-gray-50/50 rounded-2xl">
                {task.title && (
                  <p className="font-medium text-gray-700 truncate">{task.title}</p>
                )}
                {task.status !== "pending" && (
                  <ProgressBar
                    progress={task.progress}
                    speed={task.speed}
                    eta={task.eta}
                    status={task.status}
                  />
                )}
                {task.status === "pending" && (
                  <div className="text-center py-2 text-gray-500">
                    正在准备下载...
                  </div>
                )}
                {task.status === "finished" && task.filename && (
                  <button
                    onClick={handleDownloadFile}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    保存到本地
                  </button>
                )}
                {task.status === "failed" && (
                  <div className="text-center py-2 text-red-500">
                    下载失败: {task.error || "未知错误"}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                disabled={loading || !url.trim()}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    下载中...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    开始下载
                  </>
                )}
              </button>

              {loading && (
                <button
                  onClick={handleCancel}
                  className="px-6 py-4 bg-gray-200 text-gray-700 rounded-2xl font-medium hover:bg-gray-300 transition-all"
                >
                  取消
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
