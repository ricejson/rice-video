"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "登录失败");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/70 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              登录
            </h1>
            <p className="text-gray-500 mt-2">登录后即可开通 VIP 会员</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            还没有账号？
            <Link href="/register" className="text-emerald-600 font-medium ml-1 hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
