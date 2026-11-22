import React, { useMemo, useState } from 'react';
import {
  Camera,
  Heart,
  Leaf,
  MoreHorizontal,
  Search,
  Shirt,
  SlidersHorizontal,
  Star,
  WashingMachine,
} from 'lucide-react';
import { AppTab, GarmentCategory, GarmentItem } from '../types/wardrobe';

interface ClosetViewProps {
  garments: GarmentItem[];
  onTryOn: (item: GarmentItem) => void;
  onToggleLaundry: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onNavigate: (tab: AppTab) => void;
}

type StatusFilter = 'all' | 'closet' | 'laundry' | 'favorites';
type CategoryFilter = 'all' | GarmentCategory;

const PALETTE_SWATCHES: Array<{
  key: GarmentItem['paletteKey'];
  label: string;
  hex: string;
}> = [
  { key: 'mustard', label: 'Mustard yellow', hex: '#E5A823' },
  { key: 'blue', label: 'Cobalt blue', hex: '#1E40AF' },
  { key: 'slate', label: 'Slate gray', hex: '#64748B' },
  { key: 'black', label: 'Onyx black', hex: '#0D0E11' },
  { key: 'ecru', label: 'Ecru light', hex: '#E7E2D7' },
  { key: 'olive', label: 'Olive green', hex: '#4D5A38' },
];

export const ClosetView: React.FC<ClosetViewProps> = ({
  garments,
  onTryOn,
  onToggleLaundry,
  onToggleFavorite,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [paletteFilter, setPaletteFilter] = useState<GarmentItem['paletteKey'] | null>(null);
  const [sortByWears, setSortByWears] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      all: garments.length,
      closet: garments.filter((g) => g.status !== 'laundry').length,
      laundry: garments.filter((g) => g.status === 'laundry').length,
      favorites: garments.filter((g) => g.favorite).length,
      tops: garments.filter((g) => g.category === 'tops').length,
      pants: garments.filter((g) => g.category === 'pants').length,
      jackets: garments.filter((g) => g.category === 'jackets').length,
      shoes: garments.filter((g) => g.category === 'shoes').length,
      accessories: garments.filter((g) => g.category === 'accessories').length,
    };
  }, [garments]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = garments.filter((item) => {
      if (q) {
        const hay = `${item.name} ${item.brand} ${item.colorName} ${item.fabricLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'closet' && item.status === 'laundry') return false;
      if (statusFilter === 'laundry' && item.status !== 'laundry') return false;
      if (statusFilter === 'favorites' && !item.favorite) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (paletteFilter && item.paletteKey !== paletteFilter) return false;
      return true;
    });

    if (sortByWears) {
      return [...list].sort((a, b) => b.wearCount - a.wearCount);
    }
    return list;
  }, [garments, searchQuery, statusFilter, categoryFilter, paletteFilter, sortByWears]);

  const categoryLabel = (cat: GarmentCategory) => {
    if (cat === 'jackets') return 'OUTERWEAR';
    if (cat === 'tops') return 'TOPS';
    if (cat === 'pants') return 'BOTTOMS';
    if (cat === 'shoes') return 'FOOTWEAR';
    return 'ACCESSORIES';
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-5 pb-12 space-y-4">
      {/* Search & Filter Deck */}
      <section className="flex flex-col space-y-2.5 pt-1">
        <div className="relative flex items-center w-full">
          <div className="absolute left-4 flex items-center pointer-events-none text-[#c9c6c0]">
            <Search className="w-[18px] h-[18px]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${garments.length} items...`}
            className="w-full h-[52px] bg-[#1f1f23] rounded-full pl-12 pr-14 text-[#e3e2e6] placeholder:text-[#c9c6c0] font-body text-sm focus:outline-none focus:bg-[#292a2d] focus:ring-1 focus:ring-[#caf300]/50 transition-colors shadow-sm"
          />
          <button
            type="button"
            aria-label="Sort by most worn"
            onClick={() => setSortByWears((prev) => !prev)}
            className={`absolute right-1.5 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              sortByWears
                ? 'bg-[#caf300] text-[#171e00]'
                : 'bg-[#343538]/70 text-[#c9c6c0] hover:text-[#e3e2e6]'
            }`}
            title={sortByWears ? 'Sorted by Most Worn' : 'Sort by Most Worn'}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-5 px-5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono-tech text-[11px] tracking-wider transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#e3e2e6] text-[#303034] font-semibold'
                : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
            }`}
          >
            <span>ALL</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#1f1f23] text-[#e3e2e6] text-[10px] leading-none font-semibold">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('closet')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono-tech text-[11px] tracking-wider transition-colors ${
              statusFilter === 'closet'
                ? 'bg-[#e3e2e6] text-[#303034] font-semibold'
                : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
            }`}
          >
            <span>IN CLOSET</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#292a2d] text-[#c5c9ac] text-[10px] leading-none">
              {counts.closet}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('laundry')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono-tech text-[11px] tracking-wider transition-colors ${
              statusFilter === 'laundry'
                ? 'bg-[#e3e2e6] text-[#303034] font-semibold'
                : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>LAUNDRY</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#292a2d] text-[#c5c9ac] text-[10px] leading-none">
              {counts.laundry}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('favorites')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono-tech text-[11px] tracking-wider transition-colors ${
              statusFilter === 'favorites'
                ? 'bg-[#e3e2e6] text-[#303034] font-semibold'
                : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
            }`}
          >
            <Star className="w-3 h-3 text-[#caf300] fill-[#caf300]" />
            <span>FAVORITES</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#292a2d] text-[#c5c9ac] text-[10px] leading-none">
              {counts.favorites}
            </span>
          </button>
        </div>
      </section>

      {/* Category Segmentation Tabs */}
      <section className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {(
          [
            { id: 'all', label: 'All', count: counts.all },
            { id: 'tops', label: 'Tops', count: counts.tops },
            { id: 'pants', label: 'Bottoms', count: counts.pants },
            { id: 'jackets', label: 'Outerwear', count: counts.jackets },
            { id: 'shoes', label: 'Footwear', count: counts.shoes },
          ] as const
        ).map((tab) => {
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 h-9 rounded-full font-display text-[11px] tracking-wide transition-colors ${
                active
                  ? 'bg-[#caf300] text-[#171e00] font-semibold shadow-sm'
                  : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] ${active ? 'opacity-80' : 'text-[#8f9378]'}`}>
                ({tab.count})
              </span>
            </button>
          );
        })}
      </section>

      {/* Color Spectrum Strip */}
      <section className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono-tech text-[9px] uppercase text-[#c9c6c0] tracking-widest font-semibold">
            Filter by Palette
          </span>
          <button
            type="button"
            onClick={() => {
              setPaletteFilter(null);
              setCategoryFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="font-mono-tech text-[9px] text-[#caf300] font-semibold tracking-wider hover:underline"
          >
            RESET
          </button>
        </div>

        <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1">
          {PALETTE_SWATCHES.map((swatch) => {
            const selected = paletteFilter === swatch.key;
            return (
              <button
                key={swatch.key}
                type="button"
                aria-label={`${swatch.label} filter`}
                onClick={() => setPaletteFilter(selected ? null : swatch.key)}
                className={`shrink-0 p-0.5 rounded-full transition-transform active:scale-90 ${
                  selected ? 'scale-110 ring-2 ring-[#caf300]' : ''
                }`}
              >
                <span
                  className="w-7 h-7 rounded-full shadow-md flex items-center justify-center"
                  style={{ backgroundColor: swatch.hex }}
                >
                  {selected && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        swatch.key === 'ecru' || swatch.key === 'mustard'
                          ? 'bg-[#0d0e11]'
                          : 'bg-white'
                      }`}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Wardrobe 2-Column Grid (expands cleanly on desktop) */}
      {filteredItems.length === 0 ? (
        <div className="rounded-[2rem] bg-[#1b1b1f] p-8 text-center flex flex-col items-center justify-center gap-2">
          <Shirt className="w-8 h-8 text-[#8f9378]" />
          <p className="font-display text-sm font-semibold text-[#e3e2e6]">
            No garments match this filter
          </p>
          <button
            type="button"
            onClick={() => {
              setPaletteFilter(null);
              setCategoryFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="mt-1 px-4 py-2 rounded-full bg-[#caf300] text-[#171e00] font-display text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-1">
          {filteredItems.map((item) => {
            const inLaundry = item.status === 'laundry';
            const menuOpen = openMenuId === item.id;

            return (
              <article
                key={item.id}
                className="flex flex-col bg-[#1b1b1f] rounded-[1.75rem] p-2 space-y-2 shadow-md relative group"
              >
                <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#292a2d]">
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      inLaundry ? 'opacity-80' : ''
                    }`}
                  />

                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#0d0e11]/85 font-mono-tech text-[9px] font-semibold text-[#e3e2e6] uppercase tracking-wider">
                      {categoryLabel(item.category)}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="Item options"
                    onClick={() => setOpenMenuId(menuOpen ? null : item.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#0d0e11]/75 flex items-center justify-center text-[#e3e2e6] hover:bg-[#0d0e11]"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div className="absolute top-10 right-2 z-20 w-36 rounded-xl bg-[#1f1f23] border border-white/10 shadow-xl p-1 flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleFavorite(item.id);
                          setOpenMenuId(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[11px] font-body text-[#e3e2e6] hover:bg-[#292a2d]"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            item.favorite ? 'text-[#caf300] fill-[#caf300]' : 'text-[#c9c6c0]'
                          }`}
                        />
                        <span>{item.favorite ? 'Unfavorite' : 'Favorite'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onToggleLaundry(item.id);
                          setOpenMenuId(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[11px] font-body text-[#e3e2e6] hover:bg-[#292a2d]"
                      >
                        <WashingMachine className="w-3.5 h-3.5 text-amber-400" />
                        <span>{inLaundry ? 'Mark Clean' : 'Send to Laundry'}</span>
                      </button>
                    </div>
                  )}

                  {inLaundry ? (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/85 text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="font-mono-tech text-[9px] font-semibold tracking-tight uppercase">
                        In Laundry
                      </span>
                    </div>
                  ) : (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0d0e11]/85">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#caf300]" />
                      <span className="font-mono-tech text-[9px] text-[#e3e2e6] tracking-tight">
                        {item.status === 'clean' ? 'Clean' : 'Ready'} · {item.wearCount}x
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0 px-0.5 space-y-0.5">
                  <span className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase tracking-widest truncate">
                    {item.brand}
                  </span>
                  <h3 className="font-display text-sm text-[#e3e2e6] font-semibold truncate">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    <span className="font-mono-tech text-[9px] text-[#c5c9ac] truncate">
                      {item.colorName}
                    </span>
                  </div>
                </div>

                <div className="pt-0.5">
                  {inLaundry ? (
                    <button
                      type="button"
                      onClick={() => onToggleLaundry(item.id)}
                      className="w-full h-9 rounded-full bg-[#343538]/85 flex items-center justify-center gap-1.5 text-[#e3e2e6] hover:bg-[#38393c] transition-colors active:scale-95"
                    >
                      <WashingMachine className="w-4 h-4 text-amber-400" />
                      <span className="font-display text-[11px] font-semibold tracking-wide">
                        Wash Cycle
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onTryOn(item)}
                      className="w-full h-9 rounded-full bg-[#343538] flex items-center justify-center gap-1.5 text-[#e3e2e6] hover:bg-[#38393c] transition-colors active:scale-95 shadow-sm"
                    >
                      <Shirt className="w-4 h-4 text-[#caf300]" />
                      <span className="font-display text-[11px] font-semibold tracking-wide">
                        Try On
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Closet Utilization Widget */}
      <section className="mt-2 bg-[#1b1b1f] rounded-[2rem] p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#292a2d] flex items-center justify-center text-[#caf300] shrink-0">
            <Leaf className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-sm font-semibold text-[#e3e2e6]">
              Closet Utilization
            </span>
            <span className="font-body text-xs text-[#c9c6c0]">
              86% active rotation this month
            </span>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#caf300] text-[#171e00] font-mono-tech text-[11px] font-semibold">
          OPTIMAL
        </span>
      </section>

      {/* Floating Scan New Item Action */}
      <div className="sticky bottom-24 z-30 self-end flex items-center pt-1">
        <button
          type="button"
          onClick={() => onNavigate('scan')}
          className="flex items-center gap-2 pl-4 pr-5 h-13 py-3 rounded-full bg-[#caf300] text-[#171e00] shadow-[0_10px_25px_-3px_rgba(202,243,0,0.48)] hover:bg-[#b0d500] transition-all active:scale-95"
        >
          <Camera className="w-5 h-5" />
          <span className="font-display text-base font-semibold tracking-tight">
            Scan New Item
          </span>
        </button>
      </div>
    </div>
  );
};
