"use client";

import { useState } from "react";

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

interface VideoPreviewCardProps {
  video: VideoInfo;
  onDownload: () => void;
  onSummarize: () => void;
  onCancel: () => void;
  selectedEntries?: number[];
  onEntryToggle?: (index: number) => void;
  loading?: boolean;
  summarizeLoading?: boolean;
}

export default function VideoPreviewCard({
  video,
  onDownload,
  onSummarize,
  onCancel,
  selectedEntries = [],
  onEntryToggle,
  loading = false,
  summarizeLoading = false,
}: VideoPreviewCardProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  // 截断描述文字
  const truncateDescription = (text: string, maxLines: number = 3) => {
    if (!text) return "";
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join("\n") + "...";
  };

  return (
    <div className="space-y-6">
      {/* 视频预览卡片 */}
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
        {/* 封面图 */}
        <div className="relative aspect-video bg-gray-100 rounded-2xl overflow-hidden mb-6">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100">
              <svg
                className="w-16 h-16 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* 时长标签 */}
          {video.duration_str && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 text-white text-sm font-medium rounded-lg">
              {video.duration_str}
            </div>
          )}

          {/* Playlist 标签 */}
          {video.is_playlist && (
            <div className="absolute top-3 left-3 px-3 py-1.5 bg-blue-500/90 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              播放列表 ({video.playlist_count})
            </div>
          )}
        </div>

        {/* 视频信息 */}
        <div className="space-y-4">
          {/* 标题和时长 */}
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-bold text-gray-900 leading-tight">
              {video.title}
            </h3>
          </div>

          {/* 平台和作者 */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {video.platform && (
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
                {video.platform}
              </span>
            )}
            {video.uploader && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {video.uploader}
              </span>
            )}
          </div>

          {/* 描述 */}
          {video.description && (
            <div className="space-y-2">
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                {showFullDescription
                  ? video.description
                  : truncateDescription(video.description, 3)}
              </p>
              {/* 描述行数超过3行时显示展开/收起按钮 */}
              {video.description.split("\n").filter((l) => l.trim()).length > 3 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-blue-500 text-sm font-medium hover:text-blue-600 transition-colors"
                >
                  {showFullDescription ? "收起" : "展开全部"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Playlist 选择器 */}
      {video.is_playlist && video.entries.length > 0 && (
        <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              播放列表（共{video.playlist_count}个视频）
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // 选中所有
                  video.entries.forEach((_, i) => {
                    if (onEntryToggle) onEntryToggle(i + 1);
                  });
                }}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                全选
              </button>
              <button
                onClick={() => {
                  // 取消所有选中
                  selectedEntries.forEach((idx) => {
                    if (onEntryToggle) onEntryToggle(idx);
                  });
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
            {video.entries.map((entry) => (
              <div
                key={entry.index}
                onClick={() => onEntryToggle?.(entry.index)}
                className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                  selectedEntries.includes(entry.index)
                    ? "bg-blue-50 border-2 border-blue-500"
                    : "bg-gray-50/50 border-2 border-transparent hover:bg-gray-100"
                }`}
              >
                {/* 复选框 */}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    selectedEntries.includes(entry.index)
                      ? "bg-blue-500 text-white"
                      : "bg-white border-2 border-gray-300"
                  }`}
                >
                  {selectedEntries.includes(entry.index) && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* 缩略图 */}
                <div className="w-24 h-14 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {entry.thumbnail ? (
                    <img
                      src={entry.thumbnail}
                      alt={entry.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-gray-400 text-xs">{entry.index}</span>
                    </div>
                  )}
                </div>

                {/* 视频信息 */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{entry.title}</p>
                  <p className="text-sm text-gray-500">{entry.duration_str}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onDownload}
          disabled={loading}
          className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {video.is_playlist && selectedEntries.length > 0 ? "下载选中视频..." : "下载中..."}
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {video.is_playlist && selectedEntries.length > 0 ? "下载选中" : "下载视频"}
            </>
          )}
        </button>

        <button
          onClick={onSummarize}
          disabled={summarizeLoading}
          className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {summarizeLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              AI 总结生成中...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 总结
            </>
          )}
        </button>

        <button
          onClick={onCancel}
          className="px-6 py-4 bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-300 transition-all flex items-center justify-center"
        >
          取消
        </button>
      </div>
    </div>
  );
}
