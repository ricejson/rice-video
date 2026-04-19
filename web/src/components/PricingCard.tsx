"use client";

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
  const plans: Plan[] = [
    {
      id: "free",
      name: "免费版",
      price: 0,
      daily_limit: 3,
      quality: "720p",
      features: ["每日 3 次下载", "单视频下载", "720p 清晰度", "基础支持"],
    },
    {
      id: "monthly",
      name: "月卡",
      price: 29,
      daily_limit: 50,
      quality: "1080p",
      features: ["每日 50 次下载", "批量下载 5 个", "1080p 清晰度", "字幕下载", "优先支持"],
      popular: true,
    },
    {
      id: "yearly",
      name: "年卡",
      price: 199,
      daily_limit: 200,
      quality: "4K",
      features: ["每日 200 次下载", "批量下载 20 个", "4K 清晰度", "AI 视频总结", "专属客服"],
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mt-16">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          订阅套餐
        </h2>
        <p className="text-gray-500 text-lg">选择适合您的方案，解锁更多高级功能</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <span className="text-gray-500">
                    {plan.id === "yearly" ? "/年" : "/月"}
                  </span>
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
                className={`w-full py-3 mt-6 rounded-xl font-medium transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {plan.price === 0 ? "当前方案" : "立即订阅"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
