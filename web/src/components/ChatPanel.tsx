"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  taskId: string;
}

export default function ChatPanel({ taskId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "你好！我是AI助手，可以回答关于这个视频的问题。请问你想了解什么？"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/summarize/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, question: userMessage })
      });

      const data = await res.json();
      if (data.code === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: data.data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "抱歉，回答失败。" }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "抱歉，网络错误。" }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[350px]">
      {/* 消息列表 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-md shadow-lg shadow-blue-500/20"
                  : "bg-gray-100 text-gray-800 rounded-bl-md shadow-lg"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="输入关于视频的问题..."
          className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none transition-all"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          发送
        </button>
      </div>
    </div>
  );
}
