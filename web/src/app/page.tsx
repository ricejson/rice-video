import Header from "@/components/Header";
import DownloadCard from "@/components/DownloadCard";
import PricingCard from "@/components/PricingCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-7xl mx-auto space-y-16">
          <DownloadCard />
          <PricingCard />
        </div>
      </main>
      <footer className="py-8 text-center text-gray-500 text-sm">
        <p>© 2026 万能视频下载器. 仅供学习交流使用.</p>
      </footer>
    </div>
  );
}
