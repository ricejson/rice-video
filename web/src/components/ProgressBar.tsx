"use client";

interface ProgressBarProps {
  progress: number;
  speed?: string;
  eta?: string;
  status: string;
}

export default function ProgressBar({ progress, speed, eta, status }: ProgressBarProps) {
  const isFinished = status === "finished";
  const isFailed = status === "failed";

  return (
    <div className="w-full space-y-3">
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            isFinished
              ? "bg-gradient-to-r from-green-400 to-green-500"
              : isFailed
              ? "bg-gradient-to-r from-red-400 to-red-500"
              : "bg-gradient-to-r from-emerald-500 to-green-600"
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span className="font-medium">{progress.toFixed(1)}%</span>
        {!isFinished && !isFailed && (
          <div className="flex gap-4">
            {speed && <span>速度: {speed}</span>}
            {eta && <span>剩余: {eta}</span>}
          </div>
        )}
        {isFinished && <span className="text-green-600 font-medium">下载完成</span>}
        {isFailed && <span className="text-red-600 font-medium">下载失败</span>}
      </div>
    </div>
  );
}
