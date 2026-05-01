"use client";

import { useState, useEffect, useRef } from "react";
import ParseBar from "./ParseBar";
import VideoPanel from "./VideoPanel";
import SummaryPanel from "./SummaryPanel";
import { getToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

type Stage = "input" | "parsing" | "parsed" | "downloading";

export default function DownloadCard() {
  const { refresh } = useAuth();
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<TaskProgress | null>(null);
  const [error, setError] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [downloadTaskId, setDownloadTaskId] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryTaskId, setSummaryTaskId] = useState<string | null>(null);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const summarizeAbortRef = useRef<AbortController | null>(null);
  const summarizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const summarizeTriggeredRef = useRef(false);
  const maxRetries = 2;
  const retryDelay = 2000;

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (summarizeTimeoutRef.current) clearTimeout(summarizeTimeoutRef.current);
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (summarizeAbortRef.current) summarizeAbortRef.current.abort();
    };
  }, []);

  // Auto-trigger summarize when parsing completes (only if logged in)
  useEffect(() => {
    if (stage === "parsed" && task?.url && !summarizeTriggeredRef.current) {
      summarizeTriggeredRef.current = true;
      if (getToken()) {
        handleSummarize();
      }
    }
  }, [stage]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleParse = async () => {
    if (!url.trim()) {
      setError("请输入视频链接");
      return;
    }

    setLoading(true);
    setError("");
    setSummaryResult(null);
    setSummaryTaskId(null);
    setSummarizeLoading(false);
    summarizeTriggeredRef.current = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${apiBase}/api/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok && res.status >= 500) {
          throw new Error("服务器内部错误，请稍后重试");
        }

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`服务器返回异常: ${text.substring(0, 100)}`);
        }
        if (data.code !== 0) {
          throw new Error(data.message || "解析任务提交失败");
        }

        const taskId = data.data.task_id;
        setStage("parsing");
        setTask({ task_id: taskId, url, status: "parsing", progress: 0, is_playlist: false, entries: [], playlist_count: 0 });

        await pollParseResult(taskId);
        return;
      } catch (err: any) {
        const errMsg = err.message || "";
        // 网络超时错误无需重试，直接反馈给用户
        const isTimeout = errMsg.toLowerCase().includes("timed out") || errMsg.toLowerCase().includes("timeout");
        if (attempt < maxRetries && !isTimeout) {
          await sleep(retryDelay);
          continue;
        }
        setError(errMsg || "解析失败，请检查链接是否有效");
        setStage("input");
        setLoading(false);
      }
    }
  };

  const pollParseResult = async (taskId: string) => {
    return new Promise<void>((resolve, reject) => {
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${apiBase}/api/parse/${taskId}`);
          const text = await statusRes.text();
          let statusData;
          try {
            statusData = JSON.parse(text);
          } catch {
            console.error("解析轮询返回非 JSON 响应:", text.substring(0, 200));
            return;
          }

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
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError(e.message || "解析请求失败");
          setStage("input");
          setLoading(false);
          reject(e);
        }
      }, 1000);
    });
  };

  const handleDownload = async () => {
    if (!task) return;

    setLoading(true);
    setStage("downloading");

    try {
      const res = await fetch(`${apiBase}/api/download`, {
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
      setDownloadTaskId(dlTaskId);

      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${apiBase}/api/download/status/${dlTaskId}`);
          const text = await statusRes.text();
          let statusData;
          try {
            statusData = JSON.parse(text);
          } catch {
            console.error("下载轮询返回非 JSON 响应:", text.substring(0, 200));
            return;
          }

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
    if (summarizeTimeoutRef.current) {
      clearTimeout(summarizeTimeoutRef.current);
      summarizeTimeoutRef.current = null;
    }
    if (summarizeAbortRef.current) {
      summarizeAbortRef.current.abort();
      summarizeAbortRef.current = null;
    }
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    setStage("input");
    setLoading(false);
    setSummarizeLoading(false);
    setTask(null);
    setSelectedEntries([]);
    setDownloadTaskId(null);
    setSummaryResult(null);
    setSummaryTaskId(null);
    summarizeTriggeredRef.current = false;
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

    const fileUrl = `${apiBase}/api/download/file/${downloadTaskId}`;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error("下载文件失败");
      }

      const blob = await res.blob();
      const filename = task.title ? `${task.title}.mp4` : "video.mp4";
      const safeFilename = filename.replace(/[<>:"/\\|?*]/g, "_");

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: safeFilename,
            types: [{ description: 'Video Files', accept: { 'video/mp4': ['.mp4'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

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
    if (!task) return;
    if (!task.url) {
      setError("视频信息不完整，请重新解析");
      return;
    }
    if (summarizeLoading) return;

    // 未登录时提示，不发起请求
    if (!getToken()) {
      setError("AI 总结功能需要登录，请先注册免费账号（每日 3 次）");
      setSummarizeLoading(false);
      return;
    }

    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    setSummarizeLoading(true);
    setError("");
    setSummaryResult(null);

    const controller = new AbortController();
    summarizeAbortRef.current = controller;

    // 设置 5 分钟超时，防止网络问题导致无限等待
    const SUMMARIZE_TIMEOUT = 5 * 60 * 1000;
    summarizeTimeoutRef.current = setTimeout(() => {
      controller.abort();
    }, SUMMARIZE_TIMEOUT);

    try {
      // 直连后端，跳过 Next.js 代理避免 SSE 流被缓冲
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = getToken();
      const res = await fetch(`${apiBase}/api/summarize/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: task.url,
          formats: ["text", "mindmap", "chat"]
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMsg = `请求失败 (${res.status})`;
        try {
          const errBody = JSON.parse(await res.text());
          if (errBody.detail) errMsg = errBody.detail;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const fullTextRef = { current: "" };
      let currentTaskId = "";
      let timestamps = "";
      let mindmapData: any = null;
      let isDone = false;
      const displayedRef = { current: "" };

      const startTypewriter = () => {
        if (typewriterTimerRef.current) return;
        typewriterTimerRef.current = setInterval(() => {
          const full = fullTextRef.current;
          const displayed = displayedRef.current;
          if (displayed.length >= full.length) {
            if (typewriterTimerRef.current) {
              clearInterval(typewriterTimerRef.current);
              typewriterTimerRef.current = null;
            }
            return;
          }
          const nextLen = Math.min(displayed.length + 5, full.length);
          const newDisplayed = full.substring(0, nextLen);
          displayedRef.current = newDisplayed;
          setSummaryResult((prev: any) => ({
            ...prev,
            text_summary: newDisplayed,
            subtitle_with_timestamps: prev?.subtitle_with_timestamps || timestamps,
          }));
        }, 30);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));

                if (event.type === "status") {
                  currentTaskId = event.task_id || currentTaskId;
                  setSummaryTaskId(currentTaskId);
                  if (event.subtitle_with_timestamps) {
                    timestamps = event.subtitle_with_timestamps;
                    // 配额已消耗，刷新 AuthContext 中的计数
                    refresh();
                  }
                } else if (event.type === "chunk") {
                  currentTaskId = event.task_id || currentTaskId;
                  fullTextRef.current += event.content;
                  setSummaryTaskId(currentTaskId);
                  startTypewriter();
                } else if (event.type === "mindmap") {
                  mindmapData = event.data;
                  setSummaryResult((prev: any) => ({
                    ...prev,
                    mindmap: mindmapData,
                    subtitle_with_timestamps: prev?.subtitle_with_timestamps || timestamps,
                  }));
                } else if (event.type === "done") {
                  isDone = true;
                  displayedRef.current = fullTextRef.current;
                  setSummaryResult((prev: any) => ({
                    ...prev,
                    text_summary: fullTextRef.current,
                    mindmap: prev?.mindmap || mindmapData,
                    subtitle_with_timestamps: prev?.subtitle_with_timestamps || timestamps,
                  }));
                  setSummaryTaskId(event.task_id || currentTaskId);
                  setSummarizeLoading(false);
                  if (typewriterTimerRef.current) {
                    clearInterval(typewriterTimerRef.current);
                    typewriterTimerRef.current = null;
                  }
                } else if (event.type === "error") {
                  setError(event.message || "总结生成失败");
                  setSummarizeLoading(false);
                }
              } catch (e) {
                buffer = line + "\n" + buffer;
              }
            } else if (line.trim()) {
              buffer = line + "\n" + buffer;
            }
          }
        }
      }

      if (!isDone) {
        setSummarizeLoading(false);
        if (fullTextRef.current) {
          setSummaryResult((prev: any) => ({
            ...prev,
            text_summary: fullTextRef.current,
            subtitle_with_timestamps: prev?.subtitle_with_timestamps || timestamps,
          }));
          if (typewriterTimerRef.current) {
            clearInterval(typewriterTimerRef.current);
            typewriterTimerRef.current = null;
          }
        } else {
          setError("AI 总结生成中断，请重试");
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("AI 总结超时，请重试");
      } else {
        setError(err.message || "总结失败");
      }
      setSummarizeLoading(false);
    } finally {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
        summarizeTimeoutRef.current = null;
      }
      summarizeAbortRef.current = null;
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    }
  };

  return (
    <div className="w-full">
      <ParseBar
        url={url}
        onUrlChange={setUrl}
        onParse={handleParse}
        loading={stage === "parsing"}
        error={stage === "input" ? error : ""}
      />

      {stage !== "input" && task && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          {/* Left: Video Panel */}
          <div className="lg:col-span-5">
            <VideoPanel
              video={task as any}
              stage={stage as "parsing" | "parsed" | "downloading"}
              loading={loading}
              task={task}
              selectedEntries={selectedEntries}
              onEntryToggle={handleEntryToggle}
              onDownload={handleDownload}
              onCancel={handleCancel}
              onDownloadFile={handleDownloadFile}
            />
          </div>

          {/* Right: Summary Panel */}
          <div className="lg:col-span-7">
            <SummaryPanel
              summaryTaskId={summaryTaskId}
              summaryResult={summaryResult}
              isSummarizing={summarizeLoading}
              isParsing={stage === "parsing"}
            />
          </div>
        </div>
      )}

      {error && stage !== "input" && (
        <div className="mt-4 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
