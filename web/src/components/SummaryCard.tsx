"use client";

import { useState } from "react";
import MindMapViewer from "./MindMapViewer";
import ChatPanel from "./ChatPanel";

interface SummaryCardProps {
  taskId: string;
  textSummary?: string;
  mindmap?: any;
  transcript?: string;
  isStreaming?: boolean;
}

export default function SummaryCard({
  taskId,
  textSummary,
  mindmap,
  transcript,
  isStreaming = false,
}: SummaryCardProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "mindmap" | "chat" | "transcript">("summary");

  return (
    <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-6 border border-white/20">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
          AI
        </span>
        <h3 className="text-lg font-bold text-gray-900">视频总结</h3>
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
        <div className="min-h-[250px] max-h-[600px] overflow-y-auto">
          {activeTab === "summary" && (
            <div className="prose prose-blue max-w-none">
              {textSummary ? (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {textSummary}
                  {isStreaming && (
                    <span className="inline-block w-2 h-5 bg-blue-500 ml-0.5 align-middle animate-pulse rounded-sm" />
                  )}
                </div>
              ) : isStreaming ? (
                <div className="text-gray-500 text-center py-8">
                  <div className="flex gap-1 justify-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  暂无总结内容
                </div>
              )}
            </div>
          )}

          {activeTab === "mindmap" && mindmap && (
            <MindMapViewer data={mindmap} />
          )}

          {activeTab === "mindmap" && !mindmap && (
            <div className="text-center py-12">
              {isStreaming ? (
                <div className="space-y-4">
                  <div className="w-12 h-12 mx-auto bg-gradient-to-r from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center animate-pulse">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-700 font-medium">思维导图生成中...</p>
                    <p className="text-gray-400 text-sm">AI 正在分析视频内容并构建知识结构</p>
                  </div>
                  <div className="flex gap-1 justify-center">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">暂无思维导图内容</div>
              )}
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
                    <div className="flex gap-2">
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
                      <button
                        onClick={() => {
                          const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `字幕_${new Date().toISOString().slice(0, 10)}.srt`;
                          a.style.display = 'none';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载
                      </button>
                    </div>
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
  );
}

