"use client";

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

export default function MindMapViewer({ data }: MindMapViewerProps) {
  // 将根节点转换为 MindMapNode 格式
  const rootNode: MindMapNode = {
    text: data.root,
    children: data.children
  };

  // 递归渲染节点
  const renderNode = (node: MindMapNode, index: number, isRoot: boolean = false) => {
    return (
      <div key={index} className="flex flex-col items-center">
        <div
          className={`${
            isRoot
              ? "px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-500/30 font-bold text-lg min-w-[140px] text-center"
              : "px-4 py-2 bg-gradient-to-r from-indigo-400 to-purple-400 text-white rounded-xl shadow-lg shadow-indigo-500/20 font-medium min-w-[100px] text-center"
          }`}
        >
          {node.text}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="relative mt-4">
            {/* 连接线 */}
            <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-gradient-to-b from-indigo-300 to-indigo-400 -translate-x-1/2"></div>
            <div className="flex gap-4 pt-6">
              {node.children.map((child, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-indigo-300"></div>
                  {renderNode(child, i, false)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!data || !data.root) {
    return (
      <div className="text-center py-8 text-gray-500">
        思维导图数据格式错误
      </div>
    );
  }

  return (
    <div className="flex justify-center overflow-x-auto pb-8 px-4">
      <div className="flex flex-col items-center">
        {renderNode(rootNode, 0, true)}
      </div>
    </div>
  );
}
