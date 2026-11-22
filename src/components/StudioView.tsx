import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Camera,
  CheckCircle2,
  Dices,
  Plus,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sunrise,
  TrendingUp,
  X,
} from 'lucide-react';
import { AppTab, GarmentCategory, GarmentItem, MannequinOutfit } from '../types/wardrobe';
import { MannequinViewport3D } from './MannequinViewport3D';

interface StudioViewProps {
  garments: GarmentItem[];
  outfit: MannequinOutfit;
  isSaved: boolean;
  onSelectGarment: (item: GarmentItem) => void;
  onRemoveJacket: () => void;
  onShuffleFit: () => void;
  onWearToday: () => void;
  onSaveToLookbook: () => void;
  onNavigate: (tab: AppTab) => void;
  onShowToast: (msg: string) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  garments,
  outfit,
  isSaved,
  onSelectGarment,
  onRemoveJacket,
  onShuffleFit,
  onWearToday,
  onSaveToLookbook,
  onNavigate,
  onShowToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | GarmentCategory>('all');
  const [cleanOnly, setCleanOnly] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showHarmonyDetail, setShowHarmonyDetail] = useState(false);
  const [isFullscreen3D, setIsFullscreen3D] = useState(false);
  const [shufflePulse, setShufflePulse] = useState(0);

  const equippedJacket = useMemo(
    () => garments.find((g) => g.id === outfit.jacketId) || null,
    [garments, outfit.jacketId]
  );
  const equippedTop = useMemo(
    () => garments.find((g) => g.id === outfit.topId) || garments[3],
    [garments, outfit.topId]
  );
  const equippedBottom = useMemo(
    () => garments.find((g) => g.id === outfit.bottomId) || garments[6],
    [garments, outfit.bottomId]
  );
  const equippedShoes = useMemo(
    () => garments.find((g) => g.id === outfit.shoesId) || garments[8],
    [garments, outfit.shoesId]
  );

  const filteredRack = useMemo(() => {
    return garments.filter((item) => {
      if (cleanOnly && item.status === 'laundry') return false;
      if (activeCategory === 'all') return true;
      return item.category === activeCategory;
    });
  }, [garments, activeCategory, cleanOnly]);

  const isEquipped = (id: string) =>
    id === outfit.jacketId ||
    id === outfit.topId ||
    id === outfit.bottomId ||
    id === outfit.shoesId;

  const handleShuffle = () => {
    setShufflePulse((n) => n + 1);
    onShuffleFit();
  };

  const handleShare = async () => {
    const shareText = `Drip Check Studio — "${outfit.title}" (${outfit.matchScore}% Match): ${
      equippedJacket ? `${equippedJacket.name} + ` : ''
    }${equippedTop.name} + ${equippedBottom.name} + ${equippedShoes.name}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      onShowToast('Outfit breakdown copied to clipboard');
    } catch {
      onShowToast('Ready to share "Autumn Stroll" look');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto">
      {/* Top Editorial Header & Weather Context */}
      <div className="px-5 pt-1 pb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[#c9c6c0] mb-0.5">
            <Sunrise className="w-3.5 h-3.5 text-[#caf300]" />
            <span className="font-mono-tech text-[9px] font-semibold uppercase tracking-wider text-[#c9c6c0]">
              {outfit.weatherLabel}
            </span>
          </div>
          <h1 className="font-display text-[22px] leading-[28px] font-semibold tracking-tight text-[#e3e2e6]">
            {outfit.title}
          </h1>
        </div>

        {/* Match Capsule Pill */}
        <button
          type="button"
          onClick={() => setShowScoreModal((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#caf300] text-[#596c00] shadow-[0_0_20px_rgba(202,243,0,0.28)] transition-transform active:scale-95 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#2a3400] fill-[#2a3400]" />
          <span className="font-mono-tech text-[11px] font-semibold tracking-tight text-[#171e00]">
            {outfit.matchScore}% MATCH
          </span>
        </button>
      </div>

      {/* Expandable Score Breakdown Drawer */}
      {showScoreModal && (
        <div className="px-5 pb-2">
          <div className="rounded-2xl bg-[#1f1f23] p-3 flex items-center justify-between gap-3 border border-[#caf300]/20">
            <div className="flex items-center gap-4 font-mono-tech text-[10px]">
              <div>
                <span className="text-[#8f9378] block">COLOR</span>
                <span className="text-[#caf300] font-semibold">98%</span>
              </div>
              <div>
                <span className="text-[#8f9378] block">SILHOUETTE</span>
                <span className="text-[#e3e2e6] font-semibold">95%</span>
              </div>
              <div>
                <span className="text-[#8f9378] block">CLIMATE</span>
                <span className="text-[#e3e2e6] font-semibold">96%</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScoreModal(false)}
              className="w-7 h-7 rounded-full bg-[#292a2d] flex items-center justify-center text-[#c9c6c0]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Grid (Single Column Mobile, 2-Column Desktop) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:px-5 lg:items-start">
        {/* 360° 3D Mannequin Studio Canvas */}
        <div className="px-5 lg:px-0 lg:col-span-6">
          <MannequinViewport3D
            jacket={equippedJacket}
            top={equippedTop}
            bottom={equippedBottom}
            shoes={equippedShoes}
            canvasId={outfit.canvasId}
            silhouetteLabel={outfit.silhouetteLabel}
            fitBalance={outfit.fitBalance}
            shufflePulse={shufflePulse}
            onToggleFullscreen={() => setIsFullscreen3D(true)}
            onSelectSlotCategory={(cat) => {
              setActiveCategory(cat);
              onShowToast(`Filtering rack by ${cat.toUpperCase()}`);
            }}
          />
        </div>

        {/* Right Column: Harmony, Garment Rack & Actions */}
        <div className="lg:col-span-6 flex flex-col">
          {/* AI Color Harmony & Palette Breakdown Strip */}
          <div className="px-5 lg:px-0 mt-2 lg:mt-0">
            <div className="p-2.5 rounded-[1.5rem] bg-[#1f1f23] flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex -space-x-1.5 items-center shrink-0 pl-1">
                  {outfit.paletteColors.map((hex, i) => (
                    <div
                      key={`${hex}-${i}`}
                      className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/30"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono-tech text-[9px] text-[#e3e2e6] uppercase font-semibold truncate tracking-wide">
                    {outfit.harmonyTitle}
                  </span>
                  <span className="font-body text-[12px] text-[#c9c6c0] truncate">
                    {outfit.harmonySubtitle}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Inspect color harmony"
                onClick={() => setShowHarmonyDetail((prev) => !prev)}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[#caf300] hover:bg-[#292a2d] transition-colors"
              >
                <TrendingUp className="w-[18px] h-[18px]" />
              </button>
            </div>

            {showHarmonyDetail && (
              <div className="mt-2 p-3 rounded-2xl bg-[#1b1b1f] border border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {[equippedJacket, equippedTop, equippedBottom, equippedShoes]
                    .filter((g): g is GarmentItem => Boolean(g))
                    .map((g) => (
                      <div key={g.id} className="flex items-center gap-1.5 text-[11px] font-mono-tech">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: g.colorHex }}
                        />
                        <span className="text-[#c9c6c0]">{g.colorName}</span>
                      </div>
                    ))}
                </div>
                <span className="font-mono-tech text-[9px] text-[#caf300] shrink-0">
                  BALANCED
                </span>
              </div>
            )}
          </div>

          {/* Garment Rack Selector Section */}
          <div className="mt-4 flex flex-col">
            {/* Category Tabs Filter */}
            <div className="px-5 lg:px-0 flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(
                  [
                    { id: 'all', label: 'ALL' },
                    { id: 'jackets', label: 'JACKETS' },
                    { id: 'tops', label: 'TOPS' },
                    { id: 'pants', label: 'PANTS' },
                    { id: 'shoes', label: 'SHOES' },
                  ] as const
                ).map((tab) => {
                  const active = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id)}
                      className={`px-3.5 py-1.5 rounded-full font-mono-tech text-[11px] transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#e3e2e6] text-[#0d0e11] font-semibold'
                          : 'bg-[#292a2d] text-[#c9c6c0] hover:text-[#e3e2e6]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-label="Filter clean items only"
                onClick={() => {
                  setCleanOnly((prev) => !prev);
                  onShowToast(!cleanOnly ? 'Showing clean garments only' : 'Showing all wardrobe garments');
                }}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ml-2 ${
                  cleanOnly
                    ? 'bg-[#caf300] text-[#171e00]'
                    : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
                }`}
                title="Filter Clean Wardrobe"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Swappable Horizontal Apparel Strip Carousel */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-5 lg:px-0 pt-2 pb-2">
              {filteredRack.map((piece) => {
                const active = isEquipped(piece.id);
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => {
                      if (piece.slot === 'jacket' && active) {
                        onRemoveJacket();
                      } else {
                        onSelectGarment(piece);
                      }
                    }}
                    className={`shrink-0 w-32 rounded-[1.5rem] p-1.5 flex flex-col text-left relative transition-all active:scale-95 ${
                      active
                        ? 'bg-[#292a2d] shadow-md ring-1 ring-[#caf300]/35'
                        : 'bg-[#1f1f23] hover:bg-[#292a2d]'
                    }`}
                  >
                    {active && (
                      <div className="absolute top-2.5 right-2.5 z-10 w-2 h-2 rounded-full bg-[#caf300] shadow-[0_0_8px_#caf300]" />
                    )}

                    <div className="w-full aspect-[4/5] rounded-2xl bg-[#0d0e11] overflow-hidden relative">
                      <img
                        src={piece.image}
                        alt={piece.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute bottom-1.5 left-1.5 font-mono-tech text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#0d0e11]/85 ${
                          active ? 'text-[#caf300]' : 'text-[#c9c6c0]'
                        }`}
                      >
                        {active ? 'ON BODY' : `+${piece.matchBoost}%`}
                      </span>
                    </div>

                    <div className="flex flex-col mt-2 px-1 pb-1 w-full">
                      <span className="font-display text-xs font-medium text-[#e3e2e6] truncate">
                        {piece.name}
                      </span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-mono-tech text-[9px] text-[#c9c6c0] truncate max-w-[68px]">
                          {piece.brand}
                        </span>
                        <span
                          className={`font-mono-tech text-[9px] font-semibold ${
                            active ? 'text-[#caf300]' : 'text-[#e3e2e6]'
                          }`}
                        >
                          ${piece.price}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Add Piece Dropzone */}
              <button
                type="button"
                onClick={() => onNavigate('scan')}
                className="shrink-0 w-28 rounded-[1.5rem] bg-[#1b1b1f] p-2 flex flex-col items-center justify-center border border-dashed border-[#444932] hover:border-[#caf300]/60 transition-all group active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-[#1f1f23] flex items-center justify-center text-[#c9c6c0] group-hover:text-[#caf300] group-hover:bg-[#292a2d] transition-all mb-2">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] group-hover:text-[#e3e2e6] text-center uppercase">
                  Add Piece
                </span>
              </button>
            </div>
          </div>

          {/* Interactive Studio Floating Action Controls */}
          <div className="px-5 lg:px-0 mt-2 flex flex-col gap-2">
            {/* Primary Row: Shuffle Fit & Wear Today */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleShuffle}
                className="flex-1 h-[52px] px-4 rounded-full bg-[#caf300] hover:bg-[#b0d500] text-[#171e00] font-display text-[17px] font-semibold flex items-center justify-center gap-2 shadow-[0_0_24px_-4px_rgba(202,243,0,0.38)] transition-all active:scale-95"
              >
                <Dices className="w-5 h-5" />
                <span>Shuffle Fit</span>
              </button>

              <button
                type="button"
                onClick={onWearToday}
                className="flex-1 h-[52px] px-4 rounded-full bg-[#292a2d] hover:bg-[#38393c] text-[#e3e2e6] font-display text-[17px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5 text-[#caf300]" />
                <span>Wear Today</span>
              </button>
            </div>

            {/* Secondary Row: Save to Lookbook + Share & Scan */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onSaveToLookbook}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono-tech transition-colors active:scale-95 ${
                  isSaved
                    ? 'bg-[#caf300]/15 text-[#caf300] ring-1 ring-[#caf300]/40'
                    : 'bg-[#1f1f23] text-[#c9c6c0] hover:text-[#e3e2e6]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#caf300]' : ''}`} />
                <span>{isSaved ? 'Saved in Lookbook' : 'Save to Lookbook'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Share outfit"
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full bg-[#1f1f23] flex items-center justify-center text-[#c9c6c0] hover:text-[#e3e2e6] transition-colors active:scale-90"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Open garment scanner"
                  onClick={() => onNavigate('scan')}
                  className="w-10 h-10 rounded-full bg-[#1f1f23] flex items-center justify-center text-[#c9c6c0] hover:text-[#e3e2e6] transition-colors active:scale-90"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen 360° Studio Modal */}
      {isFullscreen3D && (
        <div className="fixed inset-0 z-50 bg-[#0d0e11] flex flex-col p-4 pt-safe pb-safe">
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="font-mono-tech text-[10px] text-[#caf300] uppercase tracking-widest block">
                360° STUDIO INSPECTOR
              </span>
              <h2 className="font-display text-lg font-semibold text-[#e3e2e6]">
                {outfit.title} — Drag to Rotate
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen3D(false)}
              className="w-11 h-11 rounded-full bg-[#292a2d] text-[#e3e2e6] flex items-center justify-center"
              aria-label="Close fullscreen 3D studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <MannequinViewport3D
              jacket={equippedJacket}
              top={equippedTop}
              bottom={equippedBottom}
              shoes={equippedShoes}
              canvasId={outfit.canvasId}
              silhouetteLabel={outfit.silhouetteLabel}
              fitBalance={outfit.fitBalance}
              shufflePulse={shufflePulse}
              isFullscreen
              onToggleFullscreen={() => setIsFullscreen3D(false)}
              onSelectSlotCategory={(cat) => {
                setActiveCategory(cat);
                setIsFullscreen3D(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
