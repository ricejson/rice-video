"use client";

import { useState } from "react";
import MindMapViewer from "./MindMapViewer";
import ChatPanel from "./ChatPanel";

interface SummaryCardProps {
  taskId: string;
  textSummary?: string;
  mindmap?: any;
  transcript?: string;
  onClose: () => void;
}

export default function SummaryCard({
  taskId,
  textSummary,
  mindmap,
  transcript,
  onClose
}: SummaryCardProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "mindmap" | "chat" | "transcript">("summary");

  return (
    <div className="mt-6 space-y-4">
      {/* 总结结果卡片 */}
      <div className="backdrop-blur-2xl bg-white/70 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-sm">
              AI
            </span>
            视频总结
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "summary"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📝 一键总结
          </button>
          <button
            onClick={() => setActiveTab("mindmap")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "mindmap"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🧠 思维导图
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "chat"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            💬 向AI提问
          </button>
          <button
            onClick={() => setActiveTab("transcript")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "transcript"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📄 带时间戳字幕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="min-h-[250px] max-h-[400px] overflow-y-auto">
          {activeTab === "summary" && (
            <div className="prose prose-blue max-w-none">
              {textSummary ? (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {textSummary}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  暂无总结内容
                </div>
              )}
            </div>
          )}

          {activeTab === "mindmap" && mindmap && (
            <div className="overflow-x-auto pb-4">
              <MindMapViewer data={mindmap} />
            </div>
          )}

          {activeTab === "mindmap" && !mindmap && (
            <div className="text-gray-500 text-center py-8">
              暂无思维导图内容
            </div>
          )}

          {activeTab === "chat" && (
            <ChatPanel taskId={taskId} />
          )}

          {activeTab === "transcript" && (
            <div className="space-y-4">
              {transcript ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">原始字幕，包含时间戳信息</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(transcript);
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制
                    </button>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 max-h-[350px] overflow-y-auto font-mono leading-relaxed">
                    {transcript}
                  </pre>
                </>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  暂无字幕内容
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
