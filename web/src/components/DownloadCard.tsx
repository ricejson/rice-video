"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";
import VideoPreviewCard from "./VideoPreviewCard";
import SummaryCard from "./SummaryCard";

interface TaskProgress {
  task_id: string;
  url: string;
  status: string;
  progress: number;
  speed?: string;
  eta?: string;
  title?: string;
  filename?: string;
  error?: string;
  // 解析相关字段
  thumbnail?: string;
  description?: string;
  duration?: number;
  duration_str?: string;
  uploader?: string;
  platform?: string;
  is_playlist: boolean;
  playlist_count: number;
  entries: Array<{
    index: number;
    title: string;
    duration: number;
    duration_str: string;
    thumbnail?: string;
  }>;
}

type Stage = "input" | "parsing" | "parsed" | "downloading";

export default function DownloadCard() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [loading, setLoading] = useState(false);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [task, setTask] = useState<TaskProgress | null>(null);
  const [error, setError] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [downloadTaskId, setDownloadTaskId] = useState<string | null>(null); // 单独保存下载任务的ID
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryTaskId, setSummaryTaskId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRetries = 2;
  const retryDelay = 2000;

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleParse = async () => {
    if (!url.trim()) {
      setError("请输入视频链接");
      return;
    }

    setLoading(true);
    setError("");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await res.json();
        if (data.code !== 0) {
          throw new Error(data.message || "解析任务提交失败");
        }

        const taskId = data.data.task_id;
        setStage("parsing");
        setTask({ task_id: taskId, url: url, status: "parsing", progress: 0, is_playlist: false, entries: [], playlist_count: 0 });

        await pollParseResult(taskId);
        return;

      } catch (err: any) {
        if (attempt < maxRetries) {
          await sleep(retryDelay);
          continue;
        }
        setError(err.message || "解析失败，请检查链接是否有效");
        setStage("input");
        setLoading(false);
      }
    }
  };

  const pollParseResult = async (taskId: string) => {
    return new Promise<void>((resolve, reject) => {
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/parse/${taskId}`);
          const statusData = await statusRes.json();

          if (statusData.code === 0 && statusData.data) {
            const progress = statusData.data;
            setTask(progress as TaskProgress);

            if (progress.status === "parsed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setStage("parsed");
              setLoading(false);
              if (progress.is_playlist && progress.entries?.length > 0) {
                setSelectedEntries(progress.entries.map((e: any) => e.index));
              }
              resolve();
            } else if (progress.status === "failed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setError(progress.error || "解析失败");
              setStage("input");
              setLoading(false);
              reject(new Error(progress.error || "解析失败"));
            }
          }
        } catch (e: any) {
          console.error("轮询错误:", e);
        }
      }, 1000);
    });
  };

  const handleDownload = async () => {
    if (!task) return;

    setLoading(true);
    setStage("downloading");

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: task.url,
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

      const dlTaskId = data.data.task_id;
      setDownloadTaskId(dlTaskId); // 保存下载任务的ID

      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/download/status/${dlTaskId}`);
          const statusData = await statusRes.json();

          if (statusData.code === 0 && statusData.data) {
            const progress = statusData.data;
            setTask((prev) =>
              prev
                ? {
                    ...prev,
                    status: progress.status,
                    progress: progress.progress,
                    speed: progress.speed,
                    eta: progress.eta,
                    filename: progress.filename,
                  }
                : null
            );

            if (progress.status === "finished" || progress.status === "failed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setLoading(false);
            }
          }
        } catch (e: any) {
          console.error("轮询错误:", e);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "下载失败");
      setStage("parsed");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStage("input");
    setLoading(false);
    setSummarizeLoading(false);
    setTask(null);
    setSelectedEntries([]);
    setDownloadTaskId(null);
    setSummaryResult(null);
    setSummaryTaskId(null);
    setError("");
  };

  const handleEntryToggle = (index: number) => {
    setSelectedEntries((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleDownloadFile = async () => {
    if (!downloadTaskId || !task?.filename) return;

    const fileUrl = `/api/download/file/${downloadTaskId}`;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error("下载文件失败");
      }

      const blob = await res.blob();
      const filename = task.title ? `${task.title}.mp4` : "video.mp4";
      const safeFilename = filename.replace(/[<>:"/\\|?*]/g, "_"); // 替换非法字符

      // 尝试使用 showSaveFilePicker API（现代浏览器支持）
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: safeFilename,
            types: [
              {
                description: 'Video Files',
                accept: { 'video/mp4': ['.mp4'] }
              }
            ]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          // 用户取消选择时不要报错
          if (err.name === 'AbortError') return;
          console.error('showSaveFilePicker 失败:', err);
        }
      }

      // 降级方案：使用传统的 blob URL 下载
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeFilename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };

  const handleSummarize = async () => {
    console.log("handleSummarize called, task:", task);
    if (!task) {
      console.log("task is null, returning");
      return;
    }
    if (!task.url) {
      console.log("task.url is empty, returning");
      setError("视频信息不完整，请重新解析");
      return;
    }

    // 防止重复点击
    if (summarizeLoading) {
      console.log("summarizeLoading is true, returning");
      return;
    }

    setSummarizeLoading(true);
    setError("");

    try {
      console.log("Sending summarize request for URL:", task.url);
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: task.url,
          formats: ["text", "mindmap", "chat"]
        })
      });

      const data = await res.json();
      if (data.code !== 0) {
        throw new Error(data.message || "提交总结任务失败");
      }

      const sumTaskId = data.data.task_id;
      setSummaryTaskId(sumTaskId);

      // 轮询总结结果
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/summarize/${sumTaskId}`);
          const statusData = await statusRes.json();

          if (statusData.code === 0 && statusData.data) {
            const result = statusData.data;

            if (result.status === "finished") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setSummaryResult(result.result);
              setSummarizeLoading(false);
            } else if (result.status === "failed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setError(result.error || "总结生成失败");
              setSummarizeLoading(false);
            }
          }
        } catch (e: any) {
          console.error("轮询错误:", e);
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message || "总结失败");
      setSummarizeLoading(false);
    }
  };

  const handleCloseSummary = () => {
    setSummaryResult(null);
    setSummaryTaskId(null);
  };

  // 解析中状态
  if (stage === "parsing") {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-10 border border-white/20">
          <div className="text-center space-y-6 py-8">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">正在解析链接...</h3>
              <p className="text-gray-500">正在获取视频信息，请稍候</p>
            </div>
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 解析完成且正在下载 - 同时显示预览卡片和下载进度
  if (stage === "downloading" && task) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <VideoPreviewCard
          video={task as any}
          onDownload={handleDownload}
          onSummarize={handleSummarize}
          onCancel={handleCancel}
          selectedEntries={selectedEntries}
          onEntryToggle={handleEntryToggle}
          loading={loading}
          summarizeLoading={summarizeLoading}
        />

        {/* 下载进度条 - 显示在预览卡片下方 */}
        <div className="mt-6 backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-6 border border-white/20">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">下载进度</span>
              {task.speed && (
                <span className="text-sm text-gray-500">{task.speed}</span>
              )}
            </div>
            <ProgressBar
              progress={task.progress}
              speed={task.speed}
              eta={task.eta}
              status={task.status}
            />
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
        </div>
      </div>
    );
  }

  // 解析后展示预览卡片
  if (stage === "parsed" && task) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <VideoPreviewCard
          video={task as any}
          onDownload={handleDownload}
          onSummarize={handleSummarize}
          onCancel={handleCancel}
          selectedEntries={selectedEntries}
          onEntryToggle={handleEntryToggle}
          loading={loading}
          summarizeLoading={summarizeLoading}
        />

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 总结结果展示 */}
        {summaryResult && summaryTaskId && (
          <SummaryCard
            taskId={summaryTaskId}
            textSummary={summaryResult.text_summary}
            mindmap={summaryResult.mindmap}
            transcript={summaryResult.subtitle_with_timestamps}
            onClose={handleCloseSummary}
          />
        )}
      </div>
    );
  }

  // 默认输入状态
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

            <button
              onClick={handleParse}
              disabled={loading || !url.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  解析中...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  解析链接
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
