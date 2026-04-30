"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function SuccessPage() {
  const { refresh, user } = useAuth();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (!refreshed) {
      setRefreshed(true);
      // 等待 Stripe Webhook 处理完成（通常 3-5 秒）
      setTimeout(() => {
        refresh();
      }, 3000);
    }
  }, [refreshed, refresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">支付成功！</h1>
        <p className="text-gray-500 mb-8">
          {user?.plan_id === "vip"
            ? "您已是 VIP 会员，立即体验高级功能吧！"
            : "正在开通会员中，请稍候刷新页面..."}
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
