"use client";

import VideoPreviewCard from "./VideoPreviewCard";
import ProgressBar from "./ProgressBar";

interface VideoInfo {
  task_id: string;
  url: string;
  title: string;
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

interface TaskProgress {
  status: string;
  progress: number;
  speed?: string;
  eta?: string;
  filename?: string;
  error?: string;
}

interface VideoPanelProps {
  video: VideoInfo;
  stage: "parsing" | "parsed" | "downloading";
  loading: boolean;
  task: TaskProgress | null;
  selectedEntries: number[];
  onEntryToggle: (index: number) => void;
  onDownload: () => void;
  onCancel: () => void;
  onDownloadFile: () => void;
}

export default function VideoPanel({
  video,
  stage,
  loading,
  task,
  selectedEntries,
  onEntryToggle,
  onDownload,
  onCancel,
  onDownloadFile,
}: VideoPanelProps) {
  if (stage === "parsing") {
    return (
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
        <div className="text-center space-y-6 py-8">
          <div className="w-14 h-14 mx-auto bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center animate-pulse">
            <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900">正在解析链接...</h3>
            <p className="text-gray-500 text-sm">正在获取视频信息，请稍候</p>
          </div>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all text-sm"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VideoPreviewCard
        video={video}
        onDownload={onDownload}
        onCancel={onCancel}
        selectedEntries={selectedEntries}
        onEntryToggle={onEntryToggle}
        loading={loading}
      />

      {stage === "downloading" && task && (
        <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-5 border border-white/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 text-sm">下载进度</span>
              {task.speed && (
                <span className="text-xs text-gray-500">{task.speed}</span>
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
                onClick={onDownloadFile}
                className="w-full py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                保存到本地
              </button>
            )}
            {task.status === "failed" && (
              <div className="text-center py-2 text-red-500 text-sm">
                下载失败: {task.error || "未知错误"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
