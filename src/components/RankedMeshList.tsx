import React, { useState } from "react";
import { Tag, Sparkles, Trophy, Flame, Layers } from "lucide-react";

interface RankedMeshListProps {
  meshKeywords: [string, number][]; // [term, count] sorted by count descending
  activeMesh: string | null;
  onSelectMesh: (term: string | null) => void;
  meshSearchTerm: string;
  onMeshSearchChange: (val: string) => void;
  isScanningMesh: boolean;
  meshScanProgress: { fetched: number; target: number } | null;
  onScanHistoricalMesh: () => void;
  totalCount: number;
  historicalFetchedCount: number;
}

export const RankedMeshList: React.FC<RankedMeshListProps> = ({
  meshKeywords,
  activeMesh,
  onSelectMesh,
  meshSearchTerm,
  onMeshSearchChange,
  isScanningMesh,
  meshScanProgress,
  onScanHistoricalMesh,
  totalCount,
  historicalFetchedCount,
}) => {
  const maxCount = meshKeywords.length > 0 ? meshKeywords[0][1] : 1;

  const filtered = meshKeywords.filter(([term]) =>
    meshSearchTerm.trim() === ""
      ? true
      : term.toLowerCase().includes(meshSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={meshSearchTerm}
            onChange={(e) => onMeshSearchChange(e.target.value)}
            placeholder="Filter MeSH topics by keyword..."
            className="w-full text-xs px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/80 text-white outline-none placeholder-slate-500 focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/20"
          />
        </div>

        {totalCount > historicalFetchedCount && (
          <button
            onClick={onScanHistoricalMesh}
            disabled={isScanningMesh}
            className="text-xs px-3.5 py-2 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-950/40"
          >
            {isScanningMesh ? (
              <>
                <Sparkles size={13} className="animate-spin text-amber-300" />
                Scanning ({meshScanProgress?.fetched}/{meshScanProgress?.target})...
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-amber-300" /> Process All Historical MeSH Terms
              </>
            )}
          </button>
        )}
      </div>

      {/* Ranked MeSH Tags Cloud */}
      {filtered.length === 0 ? (
        <p className="text-xs py-6 text-center text-slate-400">
          No MeSH terms matching "{meshSearchTerm}".
        </p>
      ) : (
        <div className="flex flex-wrap gap-2.5 pt-1">
          {filtered.slice(0, 40).map(([term, count]) => {
            const index = meshKeywords.findIndex(([t]) => t === term);
            const rank = index >= 0 ? index + 1 : 99;
            const isActive = activeMesh?.toLowerCase() === term.toLowerCase();
            const freqRatio = Math.round((count / maxCount) * 100);

            // Styling based on Rank
            let containerStyle = "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20";
            let rankBadgeStyle = "bg-white/10 text-slate-400";
            let icon = null;

            if (isActive) {
              containerStyle = "bg-cyan-500/30 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/50";
              rankBadgeStyle = "bg-cyan-400 text-slate-950 font-black";
            } else if (rank === 1) {
              containerStyle = "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-yellow-500/20 border-amber-400/60 text-amber-200 shadow-md shadow-amber-950/40 hover:border-amber-300";
              rankBadgeStyle = "bg-amber-400 text-slate-950 font-black";
              icon = <Trophy size={11} className="text-amber-300 shrink-0" />;
            } else if (rank === 2) {
              containerStyle = "bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-emerald-500/20 border-cyan-400/60 text-cyan-200 shadow-md shadow-cyan-950/40 hover:border-cyan-300";
              rankBadgeStyle = "bg-cyan-400 text-slate-950 font-black";
              icon = <Flame size={11} className="text-cyan-300 shrink-0" />;
            } else if (rank === 3) {
              containerStyle = "bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-indigo-500/20 border-purple-400/60 text-purple-200 shadow-md shadow-purple-950/40 hover:border-purple-300";
              rankBadgeStyle = "bg-purple-400 text-slate-950 font-black";
              icon = <Sparkles size={11} className="text-purple-300 shrink-0" />;
            } else if (rank <= 10) {
              containerStyle = "bg-slate-800/80 border-sky-400/30 text-sky-200 hover:bg-slate-800 hover:border-sky-400/60";
              rankBadgeStyle = "bg-sky-500/20 text-sky-300 border border-sky-400/30";
            }

            return (
              <button
                key={term}
                onClick={() => onSelectMesh(isActive ? null : term)}
                title={`Rank #${rank} • Appears in ${count} articles (${freqRatio}% relative index frequency)`}
                className={`group relative px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 backdrop-blur-md overflow-hidden ${containerStyle}`}
              >
                {/* Background Frequency Progress Indicator */}
                <div
                  className="absolute bottom-0 left-0 top-0 bg-white/5 pointer-events-none transition-all duration-300 group-hover:bg-white/10"
                  style={{ width: `${Math.max(freqRatio, 4)}%` }}
                />

                {/* Rank Badge */}
                <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-mono tracking-wider shrink-0 ${rankBadgeStyle}`}>
                  #{rank}
                </span>

                {icon}

                {/* Term Display */}
                <span className="relative z-10 tracking-tight">{term}</span>

                {/* Repeated Frequency Count */}
                <span className="relative z-10 px-1.5 py-0.5 rounded-md bg-slate-950/70 text-cyan-300 font-mono text-[11px] font-bold border border-white/10 shrink-0 ml-auto">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
