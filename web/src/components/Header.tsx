"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="w-full py-6 px-8 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          万能视频下载器
        </h1>
      </Link>
      <nav className="flex items-center gap-4">
        <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium text-sm">使用指南</a>
        <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium text-sm">订阅套餐</a>

        {loading ? null : user ? (
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-white text-xs font-bold rounded-full ${
              user.plan_id === "vip"
                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                : "bg-gray-400"
            }`}>
              {user.plan_id === "vip" ? "VIP 会员" : "免费用户"}
            </span>
            <Link href="/account" className="text-sm text-gray-700 hover:text-blue-600 transition-colors">
              {user.email}
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              退出
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all"
            >
              注册
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
