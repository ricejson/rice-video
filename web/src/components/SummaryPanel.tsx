"use client";

import SummaryCard from "./SummaryCard";

interface SummaryPanelProps {
  summaryTaskId: string | null;
  summaryResult: {
    text_summary?: string;
    mindmap?: any;
    subtitle_with_timestamps?: string;
  } | null;
  isSummarizing: boolean;
  isParsing: boolean;
}

export default function SummaryPanel({
  summaryTaskId,
  summaryResult,
  isSummarizing,
  isParsing,
}: SummaryPanelProps) {
  if (isParsing) {
    return (
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
        <div className="text-center space-y-6 py-8">
          <div className="w-14 h-14 mx-auto bg-gradient-to-r from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-white text-lg font-bold">AI</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900">等待视频解析...</h3>
            <p className="text-gray-500 text-sm">解析完成后将自动开始 AI 总结</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSummarizing && !summaryResult?.text_summary) {
    return (
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-green-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            AI
          </span>
          <h3 className="text-lg font-bold text-gray-900">视频总结</h3>
        </div>
        <div className="text-center space-y-4 py-6">
          <div className="flex gap-1 justify-center">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-500 text-sm">正在提取字幕并生成 AI 总结...</p>
        </div>
      </div>
    );
  }

  if (!summaryTaskId && !summaryResult) {
    return null;
  }

  return (
    <SummaryCard
      taskId={summaryTaskId || ""}
      textSummary={summaryResult?.text_summary}
      mindmap={summaryResult?.mindmap}
      transcript={summaryResult?.subtitle_with_timestamps}
      isStreaming={isSummarizing}
    />
  );
}
