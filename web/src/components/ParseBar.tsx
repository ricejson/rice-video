"use client";

interface ParseBarProps {
  url: string;
  onUrlChange: (url: string) => void;
  onParse: () => void;
  loading: boolean;
  error: string;
}

export default function ParseBar({
  url,
  onUrlChange,
  onParse,
  loading,
  error,
}: ParseBarProps) {
  return (
    <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-6 border border-white/20">
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-gray-900">视频下载 & AI 总结</h2>
          <p className="text-gray-500 text-sm">支持 1700+ 平台，一键下载与智能总结</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && url.trim() && onParse()}
              placeholder="粘贴视频链接，如 https://www.bilibili.com/video/BVxxx"
              className="w-full px-5 py-3.5 bg-gray-50/80 rounded-xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none text-gray-700 placeholder-gray-400"
              disabled={loading}
            />
            {url && !loading && (
              <button
                onClick={() => onUrlChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={onParse}
            disabled={loading || !url.trim()}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                解析中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                解析
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
