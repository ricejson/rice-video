"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  price: number;
  daily_limit: number;
  quality: string;
  features: string[];
  popular?: boolean;
}

export default function PricingCard() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const plans: Plan[] = [
    {
      id: "free",
      name: "免费版",
      price: 0,
      daily_limit: 3,
      quality: "720p",
      features: ["每日 3 次下载", "单视频下载", "720p 清晰度", "AI 视频总结"],
    },
    {
      id: "vip",
      name: "VIP 会员",
      price: 9.9,
      daily_limit: 50,
      quality: "4K",
      features: ["每日 50 次下载", "批量下载", "4K 超清画质", "字幕下载", "AI 视频总结", "优先支持"],
      popular: true,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    setError("");

    if (planId === "free") return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (user.plan_id === "vip") {
      setError("您已是 VIP 会员");
      return;
    }

    setLoading(true);
    try {
      const res = await api.createCheckout(planId);
      if (res.code === 0 && res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setError(res.message || "创建支付会话失败");
      }
    } catch (err: any) {
      setError("网络错误，请稍后重试");
    }
    setLoading(false);
  };

  const getButtonText = (plan: Plan) => {
    if (plan.id === "free") {
      if (user && user.plan_id === "free") return "当前方案";
      return "免费使用";
    }
    if (user && user.plan_id === "vip") return "已是 VIP";
    if (user) return loading ? "跳转中..." : "立即订阅";
    return "立即订阅";
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-16">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          订阅套餐
        </h2>
        <p className="text-gray-500 text-lg">选择适合您的方案，解锁更多高级功能</p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative backdrop-blur-2xl rounded-[2rem] p-8 border transition-all hover:scale-105 ${
              plan.popular
                ? "bg-white/90 shadow-2xl shadow-blue-500/20 border-blue-200"
                : "bg-white/70 shadow-lg border-white/30"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-full shadow-lg">
                最受欢迎
              </div>
            )}

            <div className="text-center space-y-4">
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>

              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gray-900">
                  {plan.price === 0 ? "免费" : `¥${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-gray-500">/月</span>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <p>每日 {plan.daily_limit} 次下载</p>
                <p>{plan.quality} 清晰度</p>
              </div>

              <ul className="space-y-3 pt-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || (user?.plan_id === "vip" && plan.id === "vip")}
                className={`w-full py-3 mt-6 rounded-xl font-medium transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl disabled:opacity-50"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {getButtonText(plan)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
