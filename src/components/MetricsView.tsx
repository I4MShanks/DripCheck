import React, { useMemo } from 'react';
import { CalendarCheck2, Flame, Layers, Sparkles, TrendingUp, WashingMachine } from 'lucide-react';
import { AppTab, GarmentItem, WornLogEntry } from '../types/wardrobe';

interface MetricsViewProps {
  garments: GarmentItem[];
  wornLog: WornLogEntry[];
  onNavigate: (tab: AppTab) => void;
}

export const MetricsView: React.FC<MetricsViewProps> = ({
  garments,
  wornLog,
  onNavigate,
}) => {
  const stats = useMemo(() => {
    const totalValue = garments.reduce((acc, g) => acc + g.price, 0);
    const totalWears = garments.reduce((acc, g) => acc + g.wearCount, 0);
    const cleanCount = garments.filter((g) => g.status !== 'laundry').length;
    const utilization = garments.length > 0 ? Math.round((cleanCount / garments.length) * 100) : 0;
    const avgCpw = totalWears > 0 ? (totalValue / totalWears).toFixed(2) : '0.00';

    const topPieces = [...garments].sort((a, b) => b.wearCount - a.wearCount).slice(0, 4);

    const categoryTotals = [
      { label: 'Outerwear', count: garments.filter((g) => g.category === 'jackets').length },
      { label: 'Tops', count: garments.filter((g) => g.category === 'tops').length },
      { label: 'Bottoms', count: garments.filter((g) => g.category === 'pants').length },
      { label: 'Footwear', count: garments.filter((g) => g.category === 'shoes').length },
    ];

    return { totalValue, totalWears, utilization, avgCpw, topPieces, categoryTotals };
  }, [garments]);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-5 pb-12 space-y-4">
      <div className="pt-1 flex items-baseline justify-between">
        <div>
          <span className="font-mono-tech text-[9px] font-semibold uppercase tracking-widest text-[#caf300] block">
            Wardrobe Telemetry
          </span>
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-[#e3e2e6] uppercase">
            Rotation Metrics
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="px-3.5 py-1.5 rounded-full bg-[#292a2d] hover:bg-[#343538] font-mono-tech text-[10px] font-semibold text-[#caf300]"
        >
          OPEN 3D STUDIO
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[1.75rem] bg-[#1b1b1f] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-[#c9c6c0]">
            <span className="font-mono-tech text-[9px] uppercase">Closet Active</span>
            <Sparkles className="w-4 h-4 text-[#caf300]" />
          </div>
          <div>
            <span className="font-display text-2xl font-semibold text-[#e3e2e6] tabular-nums">
              {stats.utilization}%
            </span>
            <span className="font-mono-tech text-[10px] text-[#caf300] block mt-0.5">
              READY TO WEAR
            </span>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-[#1b1b1f] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-[#c9c6c0]">
            <span className="font-mono-tech text-[9px] uppercase">Cost / Wear</span>
            <TrendingUp className="w-4 h-4 text-[#caf300]" />
          </div>
          <div>
            <span className="font-display text-2xl font-semibold text-[#e3e2e6] tabular-nums">
              ${stats.avgCpw}
            </span>
            <span className="font-mono-tech text-[10px] text-[#c9c6c0] block mt-0.5">
              {stats.totalWears} TOTAL WEARS
            </span>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-[#1b1b1f] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-[#c9c6c0]">
            <span className="font-mono-tech text-[9px] uppercase">Archive Value</span>
            <Layers className="w-4 h-4 text-[#c9c6c0]" />
          </div>
          <div>
            <span className="font-display text-2xl font-semibold text-[#e3e2e6] tabular-nums">
              ${stats.totalValue}
            </span>
            <span className="font-mono-tech text-[10px] text-[#c9c6c0] block mt-0.5">
              {garments.length} CURATED PIECES
            </span>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-[#1b1b1f] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-[#c9c6c0]">
            <span className="font-mono-tech text-[9px] uppercase">Fit Streak</span>
            <Flame className="w-4 h-4 text-[#caf300]" />
          </div>
          <div>
            <span className="font-display text-2xl font-semibold text-[#caf300] tabular-nums">
              {wornLog.length} Days
            </span>
            <span className="font-mono-tech text-[10px] text-[#c9c6c0] block mt-0.5">
              LOGGED THIS WEEK
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Split on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Logged Outfit Calendar */}
        <section className="rounded-[2rem] bg-[#1b1b1f] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-[#caf300]" />
              <h2 className="font-display text-base font-semibold text-[#e3e2e6]">
                Outfit Calendar Log
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] text-[#c9c6c0]">
              {wornLog.length} ENTRIES
            </span>
          </div>

          <div className="space-y-2">
            {wornLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#292a2d]/65"
              >
                <div>
                  <span className="font-mono-tech text-[9px] text-[#caf300] uppercase block">
                    {entry.dateLabel}
                  </span>
                  <span className="font-display text-sm font-semibold text-[#e3e2e6]">
                    {entry.outfitTitle}
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-[#caf300] text-[#171e00] font-mono-tech text-[10px] font-semibold">
                    {entry.matchScore}% MATCH
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Most Worn Rotation & Category Bars */}
        <section className="rounded-[2rem] bg-[#1b1b1f] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#e3e2e6]">
              Most Worn Rotation
            </h2>
            <span className="font-mono-tech text-[10px] text-[#c9c6c0]">TOP 4</span>
          </div>

          <div className="space-y-2.5">
            {stats.topPieces.map((piece) => (
              <div
                key={piece.id}
                className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-[#292a2d]/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={piece.image}
                    alt={piece.name}
                    className="w-11 h-11 rounded-xl object-cover shrink-0 bg-[#0d0e11]"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-medium text-[#e3e2e6] truncate">
                      {piece.name}
                    </p>
                    <p className="font-mono-tech text-[10px] text-[#c9c6c0] uppercase">
                      {piece.brand} · ${(piece.price / Math.max(piece.wearCount, 1)).toFixed(0)}/wear
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {piece.status === 'laundry' && (
                    <WashingMachine className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="font-mono-tech text-xs font-semibold text-[#caf300]">
                    {piece.wearCount}x
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 grid grid-cols-4 gap-2">
            {stats.categoryTotals.map((cat) => (
              <div key={cat.label} className="rounded-xl bg-[#292a2d]/60 p-2 text-center">
                <span className="font-display text-base font-semibold text-[#e3e2e6] block">
                  {cat.count}
                </span>
                <span className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
