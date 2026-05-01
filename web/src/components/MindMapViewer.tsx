"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";

// ----- 常量 -----
const NODE_W = 175;
const NODE_H = 48;
const H_GAP = 70; // 层级水平间距
const V_GAP = 20; // 兄弟节点垂直间距
const PAD = 50;   // 画布边距

// ----- 类型 -----
interface MindMapNode {
  text: string;
  children?: MindMapNode[];
}

interface MindMapData {
  root: string;
  children?: MindMapNode[];
}

interface MindMapViewerProps {
  data: MindMapData;
}

interface LayoutNode {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  children: LayoutNode[];
  depth: number;
}

// ----- 布局：递归计算每个节点的坐标 -----
function layoutTree(
  node: MindMapNode,
  depth: number,
  x: number,
  y: number
): { root: LayoutNode; totalH: number } {
  const children = node.children?.length ? node.children : [];
  if (children.length === 0) {
    return {
      root: { text: node.text, x, y, w: NODE_W, h: NODE_H, children: [], depth },
      totalH: NODE_H,
    };
  }

  const childX = x + NODE_W + H_GAP;
  let childY = y;
  const childNodes: LayoutNode[] = [];

  for (const child of children) {
    const sub = layoutTree(child, depth + 1, childX, childY);
    childNodes.push(sub.root);
    childY += sub.totalH + V_GAP;
  }
  const childrenTotalH = childY - y - V_GAP; // remove trailing gap

  // 父节点垂直居中于子节点区域
  const centerY = y + (childrenTotalH - NODE_H) / 2;

  return {
    root: {
      text: node.text,
      x,
      y: Math.max(y, centerY),
      w: NODE_W,
      h: NODE_H,
      children: childNodes,
      depth,
    },
    totalH: Math.max(NODE_H, childrenTotalH),
  };
}

// 展平为列表
function flatten(n: LayoutNode): LayoutNode[] {
  return [n, ...n.children.flatMap(flatten)];
}

// 收集连线
interface Line {
  x1: number; y1: number; x2: number; y2: number;
}
function collectLines(n: LayoutNode): Line[] {
  const lines: Line[] = [];
  for (const c of n.children) {
    lines.push({
      x1: n.x + n.w,
      y1: n.y + n.h / 2,
      x2: c.x,
      y2: c.y + c.h / 2,
    });
    lines.push(...collectLines(c));
  }
  return lines;
}

// ----- 组件 -----
export default function MindMapViewer({ data }: MindMapViewerProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // 平移 & 缩放状态
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // 保存布局数据用于 Canvas 下载
  const layoutRef = useRef({ allNodes: [] as LayoutNode[], allLines: [] as Line[], svgW: 0, svgH: 0 });

  // 全屏事件
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // 滚轮缩放（非 passive 模式，阻止页面滚动）
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(2.5, Math.max(0.3, z + delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 布局计算（数据不变时缓存）
  const { rootNode, allNodes, allLines, svgW, svgH } = useMemo(() => {
    if (!data?.root) {
      return { rootNode: null, allNodes: [], allLines: [], svgW: 600, svgH: 400 };
    }
    const { root } = layoutTree(
      { text: data.root, children: data.children },
      0,
      PAD,
      PAD
    );
    const nodes = flatten(root);
    const lines = collectLines(root);

    // 计算 SVG 尺寸
    let maxX = 0, maxY = 0;
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    return {
      rootNode: root,
      allNodes: nodes,
      allLines: lines,
      svgW: maxX + PAD,
      svgH: maxY + PAD,
    };
  }, [data]);

  // 同步布局数据到 ref，供 Canvas 下载使用
  useEffect(() => {
    layoutRef.current = { allNodes, allLines, svgW, svgH };
  }, [allNodes, allLines, svgW, svgH]);

  // --- 交互处理 ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));
  const resetView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // 全屏
  const handleFullscreen = async () => {
    if (!outerRef.current) return;
    if (!isFullscreen) {
      await outerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  // 下载：直接用 Canvas 2D 绘制，不依赖 DOM 渲染
  const handleDownload = async () => {
    const { allNodes, allLines, svgW, svgH } = layoutRef.current;
    if (!allNodes.length || downloadLoading) return;

    setDownloadLoading(true);
    try {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = svgW * scale;
      canvas.height = svgH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);

      // 白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, svgW, svgH);

      // === 绘制连线 ===
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (const l of allLines) {
        const midX = l.x1 + (l.x2 - l.x1) * 0.45;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.bezierCurveTo(midX, l.y1, midX, l.y2, l.x2, l.y2);
        ctx.stroke();
      }

      // === 绘制节点 ===
      const radius = 12;
      const drawRoundRect = (x: number, y: number, w: number, h: number) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };

      for (const n of allNodes) {
        const isRoot = n.depth === 0;
        const isL1 = n.depth === 1;
        const isL2 = n.depth === 2;

        if (isRoot) {
          const grad = ctx.createLinearGradient(n.x, n.y, n.x + n.w, n.y);
          grad.addColorStop(0, "#10b050");
          grad.addColorStop(1, "#059669");
          ctx.fillStyle = grad;
          drawRoundRect(n.x, n.y, n.w, n.h);
          ctx.fill();
        } else if (isL1) {
          const grad = ctx.createLinearGradient(n.x, n.y, n.x + n.w, n.y);
          grad.addColorStop(0, "#34d399");
          grad.addColorStop(1, "#10b050");
          ctx.fillStyle = grad;
          drawRoundRect(n.x, n.y, n.w, n.h);
          ctx.fill();
        } else {
          ctx.fillStyle = isL2 ? "#ffffff" : "#ffffff";
          ctx.strokeStyle = isL2 ? "#6ee7b7" : "#d1d5db";
          ctx.lineWidth = isL2 ? 2 : 1;
          drawRoundRect(n.x, n.y, n.w, n.h);
          ctx.fill();
          ctx.stroke();
        }

        // 文字
        ctx.fillStyle = isRoot || isL1 ? "#ffffff" : "#374151";
        const fontSize = isRoot ? 15 : isL1 ? 13 : 11;
        const fontWeight = isRoot ? "bold " : isL1 ? "600 " : "500 ";
        ctx.font = `${fontWeight}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const maxChars = Math.floor((n.w - 16) / (fontSize * 0.6));
        const text = n.text;
        const lines: string[] = [];
        if (text.length <= maxChars) {
          lines.push(text);
        } else {
          lines.push(text.substring(0, maxChars));
          const rest = text.substring(maxChars);
          lines.push(rest.length <= maxChars ? rest : rest.substring(0, maxChars - 1) + "\u2026");
        }

        const lineHeight = fontSize * 1.4;
        const totalH = lines.length * lineHeight;
        const startY = n.y + n.h / 2 - totalH / 2 + lineHeight / 2;
        for (let i = 0; i < Math.min(lines.length, 2); i++) {
          ctx.fillText(lines[i], n.x + n.w / 2, startY + i * lineHeight);
        }
      }

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) return;

      const filename = `思维导图_${new Date().toISOString().slice(0, 10)}.png`;

      // 优先使用 showSaveFilePicker 让用户选择保存位置
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [
              { description: "PNG 图片", accept: { "image/png": [".png"] } },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === "AbortError") return; // 用户取消
        }
      }

      // 降级：传统 blob URL 下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("下载失败:", e);
    } finally {
      setDownloadLoading(false);
    }
  };

  if (!rootNode) {
    return <div className="text-center py-8 text-gray-500">思维导图数据格式错误</div>;
  }

  return (
    <div className="relative">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1 mr-2">
          <button onClick={zoomIn} title="放大"
            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 text-sm font-bold">+</button>
          <button onClick={zoomOut} title="缩小"
            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 text-sm font-bold">−</button>
          <button onClick={resetView} title="重置视图"
            className="px-2 h-7 flex items-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 text-xs">
            {Math.round(zoom * 100)}%
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 mr-2">拖拽移动 · 滚轮缩放</span>
        <button onClick={handleFullscreen}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all flex items-center gap-1">
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
        <button onClick={handleDownload} disabled={downloadLoading}
          className="px-3 py-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50">
          {downloadLoading ? "生成中..." : "下载"}
        </button>
      </div>

      {/* 画布容器 */}
      <div
        ref={outerRef}
        className={`rounded-xl border border-gray-200 overflow-hidden select-none ${
          isFullscreen ? "bg-white w-screen h-screen" : "bg-gray-50/50"
        }`}
        style={isFullscreen ? {} : { height: "520px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: svgW,
            height: svgH,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isPanning.current ? "none" : "transform 0.1s ease-out",
          }}
        >
          {/* SVG 连线层 */}
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={svgW}
            height={svgH}
          >
            <defs>
              <linearGradient id="lineG" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#10b050" />
              </linearGradient>
            </defs>
            {allLines.map((l, i) => {
              const midX = l.x1 + (l.x2 - l.x1) * 0.45;
              return (
                <path
                  key={i}
                  d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
                  fill="none"
                  stroke="url(#lineG)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* 节点层 */}
          {allNodes.map((n, i) => {
            const isRoot = n.depth === 0;
            const isL1 = n.depth === 1;
            const isL2 = n.depth === 2;
            return (
              <div
                key={i}
                className={`absolute rounded-xl flex items-center justify-center text-center leading-snug transition-transform hover:scale-[1.03] ${
                  isRoot
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-500/20 font-bold text-base"
                    : isL1
                    ? "bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-500/15 font-semibold text-sm"
                    : isL2
                    ? "bg-white border-2 border-emerald-200 text-gray-700 shadow-md font-medium text-xs"
                    : "bg-white border border-gray-200 text-gray-600 shadow-sm text-xs"
                }`}
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                }}
                title={n.text}
              >
                <span className="line-clamp-2 px-2">{n.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
