"use client";

export default function Header() {
  return (
    <header className="w-full py-6 px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          万能视频下载器
        </h1>
      </div>
      <nav className="flex items-center gap-6">
        <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">使用指南</a>
        <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">订阅套餐</a>
        <button className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all">
          立即使用
        </button>
      </nav>
    </header>
  );
}
