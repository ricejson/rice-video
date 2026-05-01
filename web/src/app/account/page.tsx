"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Header from "@/components/Header";

export default function AccountPage() {
  const { user, subscription, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">请先登录</p>
          <Link
            href="/login"
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  const planName = user.plan_id === "vip" ? "VIP 会员" : "免费用户";
  const planBadge = user.plan_id === "vip"
    ? "bg-gradient-to-r from-amber-400 to-orange-500"
    : "bg-gray-400";

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white/20">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">账号信息</h1>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">邮箱</span>
              <span className="text-gray-900 font-medium">{user.email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">当前套餐</span>
              <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${planBadge}`}>
                {planName}
              </span>
            </div>

            {subscription && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">订阅状态</span>
                <span className={subscription.status === "active" ? "text-green-600 font-medium" : "text-gray-500"}>
                  {subscription.status === "active" ? "生效中" : subscription.status}
                </span>
              </div>
            )}

            {subscription?.current_period_end && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">到期时间</span>
                <span className="text-gray-900">
                  {new Date(subscription.current_period_end).toLocaleDateString("zh-CN")}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-500">今日下载次数</span>
              <span className="text-gray-900 font-medium">
                {subscription?.daily_download_count ?? 0}
                {" / "}
                {user.plan_id === "vip" ? "50" : "3"}
              </span>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            {user.plan_id !== "vip" && (
              <Link
                href="/"
                className="flex-1 text-center py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
              >
                升级 VIP
              </Link>
            )}
            <button
              onClick={logout}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              退出登录
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
