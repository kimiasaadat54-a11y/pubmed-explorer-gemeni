import React, { useMemo, useState } from "react";
import { Network, Sparkles, Filter, Info, ZoomIn, RefreshCw } from "lucide-react";

interface MeshGraphProps {
  historicalMeshLists: string[][];
  activeMesh: string | null;
  onSelectMesh: (term: string | null) => void;
}

interface Node {
  id: string;
  label: string;
  count: number;
  rank: number;
  x: number;
  y: number;
  color: string;
  badgeBg: string;
  badgeBorder: string;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  sourceNode: Node;
  targetNode: Node;
}

const RANK_COLORS = [
  {
    bg: "from-amber-500 to-emerald-500",
    text: "text-amber-300",
    border: "border-amber-400/60",
    glow: "shadow-amber-500/30",
    fill: "#f59e0b",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/40"
  },
  {
    bg: "from-blue-500 to-cyan-400",
    text: "text-cyan-300",
    border: "border-cyan-400/60",
    glow: "shadow-cyan-500/30",
    fill: "#06b6d4",
    badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
  },
  {
    bg: "from-indigo-500 to-purple-500",
    text: "text-purple-300",
    border: "border-purple-400/60",
    glow: "shadow-purple-500/30",
    fill: "#a855f7",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-400/40"
  },
  {
    bg: "from-blue-600 to-sky-400",
    text: "text-sky-300",
    border: "border-sky-400/40",
    glow: "shadow-sky-500/20",
    fill: "#38bdf8",
    badgeBg: "bg-sky-500/20 text-sky-300 border-sky-400/30"
  },
];

const STOPWORDS = new Set([
  "and", "the", "for", "with", "human", "humans", "male", "female",
  "adult", "middle aged", "aged", "young adult", "child", "infant",
  "animals", "mice", "rats", "study", "studies", "article", "journal"
]);

export const MeshCooccurrenceGraph: React.FC<MeshGraphProps> = ({
  historicalMeshLists,
  activeMesh,
  onSelectMesh,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [topCountFilter, setTopCountFilter] = useState<number>(12);

  // Compute frequent terms and co-occurrence matrix
  const { nodes, edges, topTerms } = useMemo(() => {
    const termFreq: Record<string, { display: string; count: number }> = {};
    const coOccurrence: Record<string, Record<string, number>> = {};

    historicalMeshLists.forEach((list) => {
      const uniqueInDoc = Array.from(
        new Set(
          list
            .map((t) => t.trim())
            .filter((t) => t.length > 1 && !STOPWORDS.has(t.toLowerCase()))
        )
      );

      uniqueInDoc.forEach((termA) => {
        const keyA = termA.toLowerCase();
        if (!termFreq[keyA]) {
          termFreq[keyA] = { display: termA, count: 0 };
        }
        termFreq[keyA].count += 1;

        if (!coOccurrence[keyA]) coOccurrence[keyA] = {};

        uniqueInDoc.forEach((termB) => {
          const keyB = termB.toLowerCase();
          if (keyA !== keyB) {
            coOccurrence[keyA][keyB] = (coOccurrence[keyA][keyB] || 0) + 1;
          }
        });
      });
    });

    const sortedTerms = Object.values(termFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, topCountFilter);

    if (sortedTerms.length === 0) {
      return { nodes: [], edges: [], topTerms: [] };
    }

    const maxCount = sortedTerms[0].count;
    const minCount = sortedTerms[sortedTerms.length - 1].count;

    // Arrange nodes in radial graph circle for clear network visualization
    const centerX = 300;
    const centerY = 200;
    const radiusX = 220;
    const radiusY = 130;

    const computedNodes: Node[] = sortedTerms.map((item, idx) => {
      const angle = (idx / sortedTerms.length) * 2 * Math.PI - Math.PI / 2;
      const rank = idx + 1;

      let colorConfig = RANK_COLORS[3];
      if (rank === 1) colorConfig = RANK_COLORS[0];
      else if (rank === 2) colorConfig = RANK_COLORS[1];
      else if (rank === 3) colorConfig = RANK_COLORS[2];

      return {
        id: item.display.toLowerCase(),
        label: item.display,
        count: item.count,
        rank,
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
        color: colorConfig.fill,
        badgeBg: colorConfig.badgeBg,
        badgeBorder: colorConfig.border
      };
    });

    const nodeMap = new Map<string, Node>(computedNodes.map((n) => [n.id, n]));

    const computedEdges: Edge[] = [];
    const addedPairs = new Set<string>();

    computedNodes.forEach((nodeA) => {
      const keyA = nodeA.id;
      if (coOccurrence[keyA]) {
        Object.entries(coOccurrence[keyA]).forEach(([keyB, weight]) => {
          const nodeB = nodeMap.get(keyB);
          if (nodeB) {
            const pairKey = [keyA, keyB].sort().join("<->");
            if (!addedPairs.has(pairKey) && weight >= 1) {
              addedPairs.add(pairKey);
              computedEdges.push({
                source: keyA,
                target: keyB,
                weight,
                sourceNode: nodeA,
                targetNode: nodeB,
              });
            }
          }
        });
      }
    });

    return { nodes: computedNodes, edges: computedEdges, topTerms: sortedTerms };
  }, [historicalMeshLists, topCountFilter]);

  const maxEdgeWeight = useMemo(() => {
    return edges.length > 0 ? Math.max(...edges.map((e) => e.weight)) : 1;
  }, [edges]);

  const activeNodeId = activeMesh ? activeMesh.toLowerCase() : null;
  const currentHighlightId = hoveredNodeId || activeNodeId;

  const connectedNodeIds = useMemo(() => {
    if (!currentHighlightId) return new Set<string>();
    const set = new Set<string>([currentHighlightId]);
    edges.forEach((e) => {
      if (e.source === currentHighlightId) set.add(e.target);
      if (e.target === currentHighlightId) set.add(e.source);
    });
    return set;
  }, [currentHighlightId, edges]);

  if (nodes.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400 bg-white/5 border border-white/10 rounded-2xl">
        No MeSH co-occurrence data available yet. Fetch or scan articles to generate graph.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Network size={16} className="text-cyan-400" /> Interactive MeSH Keyword Co-occurrence Network
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Lines illustrate terms appearing together in PubMed abstracts. Line thickness indicates co-occurrence frequency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Show Top:</span>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {[8, 12, 16, 20].map((num) => (
              <button
                key={num}
                onClick={() => setTopCountFilter(num)}
                className={`text-xs px-2.5 py-1 rounded-lg transition font-mono font-semibold cursor-pointer ${
                  topCountFilter === num
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Interactive Graph Canvas */}
      <div className="relative w-full h-[360px] bg-slate-950/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 600 400" className="w-full h-full select-none">
          <defs>
            <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Render Edges */}
          {edges.map((e, idx) => {
            const isHighlighted =
              currentHighlightId &&
              (e.source === currentHighlightId || e.target === currentHighlightId);
            const isDimmed = currentHighlightId && !isHighlighted;

            const strokeWidth = Math.max(1, (e.weight / maxEdgeWeight) * 5);
            const opacity = isHighlighted ? 0.9 : isDimmed ? 0.08 : 0.35;

            return (
              <g key={idx}>
                <line
                  x1={e.sourceNode.x}
                  y1={e.sourceNode.y}
                  x2={e.targetNode.x}
                  y2={e.targetNode.y}
                  stroke={isHighlighted ? "#38bdf8" : "rgba(148, 163, 184, 0.4)"}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={isHighlighted ? "none" : "3 3"}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            const isActive = activeNodeId === node.id;
            const isConnected = connectedNodeIds.has(node.id);
            const isDimmed = currentHighlightId && !isConnected;

            const radius = Math.max(14, Math.min(26, 12 + node.count * 1.5));

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => onSelectMesh(isActive ? null : node.label)}
                className="cursor-pointer transition-all duration-200"
                style={{ opacity: isDimmed ? 0.25 : 1 }}
              >
                {/* Glow ring for rank 1-3 */}
                {(isActive || isHovered || node.rank <= 3) && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={isActive ? 3 : 1.5}
                    strokeOpacity={isActive ? 0.9 : 0.4}
                    className={node.rank === 1 ? "animate-pulse" : ""}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={radius}
                  fill={node.color}
                  fillOpacity={isActive || isHovered ? 1 : 0.85}
                  stroke={isActive ? "#ffffff" : "rgba(255, 255, 255, 0.3)"}
                  strokeWidth={2}
                  className="transition-all duration-200 shadow-xl"
                />

                {/* Rank Text in Circle */}
                <text
                  textAnchor="middle"
                  dy=".3em"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#0f172a"
                >
                  #{node.rank}
                </text>

                {/* Term Label Text with Repeated Count */}
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isActive || isHovered ? "bold" : "600"}
                  fill={isActive ? "#38bdf8" : isHovered ? "#ffffff" : "#cbd5e1"}
                  className="pointer-events-none drop-shadow-md"
                >
                  {(node.label.length > 16 ? node.label.slice(0, 14) + "…" : node.label) + ` (${node.count})`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating tooltip when node is hovered */}
        {hoveredNodeId && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-cyan-400/40 backdrop-blur-xl px-3.5 py-2 rounded-xl text-xs text-slate-200 shadow-2xl pointer-events-none">
            {(() => {
              const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
              if (!hoveredNode) return null;

              const coTerms = edges
                .filter((e) => e.source === hoveredNodeId || e.target === hoveredNodeId)
                .map((e) => ({
                  term: e.source === hoveredNodeId ? e.targetNode.label : e.sourceNode.label,
                  weight: e.weight,
                }))
                .sort((a, b) => b.weight - a.weight);

              return (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-cyan-300">
                      Rank #{hoveredNode.rank}: {hoveredNode.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-mono">
                      {hoveredNode.count} articles
                    </span>
                  </div>
                  {coTerms.length > 0 ? (
                    <p className="text-[10px] text-slate-400">
                      Frequently co-occurs with:{" "}
                      <span className="text-slate-200 font-medium">
                        {coTerms.slice(0, 3).map((c) => `${c.term} (${c.weight})`).join(", ")}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400">Unique standalone MeSH keyword in this subset</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Info size={12} className="text-cyan-400" /> Click any node to filter PubMed results table by that MeSH term.
        </span>
        {activeMesh && (
          <button
            onClick={() => onSelectMesh(null)}
            className="text-cyan-300 hover:underline font-medium cursor-pointer"
          >
            Clear MeSH Filter ({activeMesh})
          </button>
        )}
      </div>
    </div>
  );
};
