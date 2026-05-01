const API_BASE = "/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.substring(0, 200) || `服务器返回异常 (HTTP ${res.status})`);
  }
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<{ user: any; subscription: any }>("/auth/me"),

  createCheckout: (planId: string) =>
    request<{ checkout_url: string }>("/payment/create-checkout", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        success_url: `${window.location.origin}/success`,
        cancel_url: `${window.location.origin}/`,
      }),
    }),

  getPlans: () => request<any[]>("/subscribe/plans"),
};
