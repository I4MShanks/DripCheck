import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Eye,
  Plus,
  Share2,
  Sparkles,
  Sun,
  Thermometer,
  User,
  Wand2,
  Zap,
} from 'lucide-react';
import { CuratedLook } from '../types/wardrobe';

interface LookbookViewProps {
  looks: CuratedLook[];
  bookmarkedIds: string[];
  rotationIds: string[];
  onWearOnMannequin: (look: CuratedLook) => void;
  onToggleBookmark: (id: string) => void;
  onAddToRotation: (look: CuratedLook) => void;
  onShowToast: (msg: string) => void;
}

const FEED_FILTERS = [
  { id: 'for-you', label: 'For You' },
  { id: 'streetwear', label: 'Streetwear Casual' },
  { id: 'office', label: 'Smart Office' },
  { id: 'dinner', label: 'Weekend Dinner' },
  { id: 'rainy', label: 'Rainy Day' },
] as const;

export const LookbookView: React.FC<LookbookViewProps> = ({
  looks,
  bookmarkedIds,
  rotationIds,
  onWearOnMannequin,
  onToggleBookmark,
  onAddToRotation,
  onShowToast,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<(typeof FEED_FILTERS)[number]['id']>('for-you');
  const [remixedOrder, setRemixedOrder] = useState(false);
  const [remixing, setRemixing] = useState(false);

  const visibleLooks = useMemo(() => {
    const base =
      selectedFilter === 'for-you'
        ? looks
        : looks.filter((l) => l.feedCategory === selectedFilter || selectedFilter === 'dinner' || selectedFilter === 'rainy');

    if (remixedOrder) {
      return [...base].reverse();
    }
    return base;
  }, [looks, selectedFilter, remixedOrder]);

  const handleRemix = () => {
    setRemixing(true);
    setTimeout(() => {
      setRemixing(false);
      setRemixedOrder((prev) => !prev);
      onShowToast('Neural Stylist remixed daily fit rotation');
    }, 650);
  };

  const handleShareLook = async (look: CuratedLook) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          `Drip Check Lookbook — ${look.title} (${look.matchScore}% Match)`
        );
      }
      onShowToast(`Shared "${look.title}" link`);
    } catch {
      onShowToast(`Ready to share "${look.title}"`);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto pb-12">
      {/* Top Editorial Header & Weather Context */}
      <section className="px-5 pt-1 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#caf300]" />
            <span className="font-mono-tech text-[9px] font-semibold uppercase tracking-wider text-[#caf300]">
              AI Drip Feed • Daily Curations
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#292a2d]/85 text-[#e3e2e6] shadow-sm">
            <Sun className="w-3.5 h-3.5 text-[#caf300]" />
            <span className="font-mono-tech text-[9px] font-semibold tracking-tight text-[#c9c6c0]">
              NYC 62°F • Crisp
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-0.5">
          <h1 className="font-display text-[32px] leading-[38px] font-semibold tracking-tight text-[#e3e2e6] uppercase">
            Curated Fits
          </h1>
          <span className="font-mono-tech text-[11px] text-[#c9c6c0]">Issue #48</span>
        </div>
      </section>

      {/* Filter Carousel */}
      <section className="w-full pb-4 overflow-x-auto no-scrollbar px-5">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {FEED_FILTERS.map((filter) => {
            const active = selectedFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSelectedFilter(filter.id)}
                className={`h-9 px-4 rounded-full font-display text-[11px] font-medium tracking-wider uppercase transition-colors flex items-center gap-1.5 shrink-0 ${
                  active
                    ? 'bg-[#caf300] text-[#171e00] font-semibold shadow-md'
                    : 'bg-[#292a2d] text-[#c9c6c0] hover:text-[#e3e2e6]'
                }`}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#171e00]" />}
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Editorial Look Cards Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 px-5">
        {visibleLooks.map((look) => {
          const isBookmarked = bookmarkedIds.includes(look.id);
          const isInRotation = rotationIds.includes(look.id);

          return (
            <article
              key={look.id}
              className="relative flex flex-col rounded-[2rem] bg-[#1b1b1f] shadow-xl overflow-hidden"
            >
              {/* Top Meta Bar */}
              <div className="p-4 flex items-center justify-between bg-[#1b1b1f]">
                <div className="min-w-0 pr-2">
                  <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase tracking-widest block">
                    {look.issueIndex}
                  </span>
                  <h2 className="font-display text-[20px] leading-tight font-semibold text-[#e3e2e6] tracking-tight uppercase truncate">
                    {look.title}
                  </h2>
                </div>

                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0 ${
                    look.matchScore >= 96
                      ? 'bg-[#caf300] text-[#171e00] shadow-[0_0_16px_rgba(202,243,0,0.3)]'
                      : look.matchScore >= 93
                      ? 'bg-[#343538] text-[#caf300]'
                      : 'bg-[#343538] text-[#c9c6c0]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span className="font-mono-tech text-[11px] font-semibold">
                    {look.matchScore}% MATCH
                  </span>
                </div>
              </div>

              {/* Collage Layout */}
              {look.layout === 'trio' && (
                <div className="relative w-full grid grid-cols-12 gap-1 bg-[#0d0e11] p-1">
                  <div className="col-span-7 h-72 rounded-xl bg-[#292a2d] overflow-hidden relative">
                    <img
                      src={look.images.primary}
                      alt={look.images.primaryLabel}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                      {look.images.primaryLabel}
                    </div>
                  </div>
                  <div className="col-span-5 flex flex-col gap-1 h-72">
                    <div className="flex-1 rounded-xl bg-[#292a2d] overflow-hidden relative">
                      <img
                        src={look.images.secondaryTop}
                        alt={look.images.secondaryTopLabel}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                        {look.images.secondaryTopLabel}
                      </div>
                    </div>
                    <div className="h-32 rounded-xl bg-[#292a2d] overflow-hidden relative">
                      <img
                        src={look.images.secondaryBottom}
                        alt={look.images.secondaryBottomLabel}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                        {look.images.secondaryBottomLabel}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {look.layout === 'duo' && (
                <div className="relative w-full h-76 bg-[#0d0e11] p-1 grid grid-cols-2 gap-1">
                  <div className="h-full rounded-xl bg-[#292a2d] overflow-hidden relative">
                    <img
                      src={look.images.primary}
                      alt={look.images.primaryLabel}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                      {look.images.primaryLabel}
                    </div>
                  </div>
                  <div className="h-full rounded-xl bg-[#292a2d] overflow-hidden relative">
                    <img
                      src={look.images.secondaryTop}
                      alt={look.images.secondaryTopLabel}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                      {look.images.secondaryTopLabel}
                    </div>
                  </div>
                </div>
              )}

              {look.layout === 'wide' && (
                <div className="relative w-full h-56 bg-[#0d0e11] p-1">
                  <div className="w-full h-full rounded-xl bg-[#292a2d] overflow-hidden relative">
                    <img
                      src={look.images.primary}
                      alt={look.images.primaryLabel}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0d0e11]/85 text-[#e3e2e6] font-mono-tech text-[9px] font-semibold">
                      {look.images.primaryLabel}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Content per Layout */}
              {look.layout === 'trio' && (
                <div className="p-4 flex flex-col gap-2.5 bg-[#1b1b1f]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase tracking-wider">
                      {look.paletteLabel}
                    </span>
                    <div className="flex items-center -space-x-1.5">
                      {look.paletteColors.map((hex, idx) => (
                        <span
                          key={`${hex}-${idx}`}
                          className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/30"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {look.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded bg-[#292a2d] text-[#c9c6c0] font-mono-tech text-[9px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onWearOnMannequin(look)}
                      className="flex-1 h-11 px-4 rounded-full bg-[#caf300] hover:bg-[#b0d500] text-[#171e00] font-display text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                    >
                      <User className="w-4 h-4" />
                      <span>Wear on Mannequin</span>
                    </button>

                    <button
                      type="button"
                      aria-label="Bookmark look"
                      onClick={() => onToggleBookmark(look.id)}
                      className={`w-11 h-11 rounded-full bg-[#292a2d] flex items-center justify-center active:scale-90 transition-transform ${
                        isBookmarked ? 'text-[#caf300]' : 'text-[#c9c6c0] hover:text-[#e3e2e6]'
                      }`}
                    >
                      <Bookmark className={`w-[18px] h-[18px] ${isBookmarked ? 'fill-[#caf300]' : ''}`} />
                    </button>

                    <button
                      type="button"
                      aria-label="Share look"
                      onClick={() => handleShareLook(look)}
                      className="w-11 h-11 rounded-full bg-[#292a2d] text-[#c9c6c0] hover:text-[#e3e2e6] flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Share2 className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </div>
              )}

              {look.layout === 'duo' && (
                <div className="p-4 flex flex-col gap-3 bg-[#1b1b1f]">
                  {look.stylistNote && (
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#292a2d]/70">
                      <Thermometer className="w-4 h-4 text-[#caf300] shrink-0 mt-0.5" />
                      <p className="font-body text-xs leading-relaxed text-[#e3e2e6]">
                        <span className="font-semibold text-[#caf300]">Stylist Note: </span>
                        {look.stylistNote}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1.5">
                      {look.paletteColors.map((hex, idx) => (
                        <span
                          key={`${hex}-${idx}`}
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      <span className="font-mono-tech text-[9px] text-[#c9c6c0] ml-1">
                        {look.paletteLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onWearOnMannequin(look)}
                      className="h-10 px-4 rounded-full bg-[#292a2d] hover:bg-[#343538] text-[#e3e2e6] font-display text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              )}

              {look.layout === 'wide' && (
                <div className="p-4 flex items-center justify-between bg-[#1b1b1f] gap-3">
                  <div className="flex flex-col">
                    <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase">
                      Estimated Prep Time
                    </span>
                    <span className="font-body text-sm text-[#e3e2e6] font-semibold">
                      {look.prepTime}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddToRotation(look)}
                    className={`h-10 px-4 rounded-full font-display text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 transition-colors shrink-0 ${
                      isInRotation
                        ? 'bg-[#caf300] text-[#171e00]'
                        : 'bg-[#292a2d] hover:bg-[#343538] text-[#e3e2e6]'
                    }`}
                  >
                    <span>{isInRotation ? 'In Rotation' : 'Add to Rotation'}</span>
                    {isInRotation ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Algorithmic Footer Signature */}
      <div className="px-5 mt-5">
        <div className="p-6 rounded-[2rem] bg-[#0d0e11] flex flex-col items-center justify-center text-center gap-1.5">
          <Sparkles className="w-7 h-7 text-[#caf300]" />
          <h3 className="font-display text-base font-semibold text-[#e3e2e6] uppercase">
            Curated by Neural Stylist v4.2
          </h3>
          <p className="font-body text-xs text-[#c9c6c0] max-w-xs">
            Recalibrated hourly based on real-time climate drops, calendar events, and closet wear-frequency.
          </p>
        </div>
      </div>

      {/* Floating Remix Outfits Button */}
      <div className="sticky bottom-24 z-30 self-end px-5 pt-3">
        <button
          type="button"
          onClick={handleRemix}
          className="flex items-center gap-2 pl-4 pr-5 h-13 py-3 rounded-full bg-[#caf300] hover:bg-[#b0d500] text-[#171e00] shadow-[0_8px_24px_rgba(202,243,0,0.38)] active:scale-95 transition-transform"
        >
          <Wand2
            className={`w-5 h-5 ${remixing ? 'animate-spin' : ''}`}
            style={{ animationDuration: '0.7s' }}
          />
          <span className="font-display text-sm tracking-wider uppercase font-semibold">
            {remixing ? 'Curating...' : 'Remix Outfits'}
          </span>
        </button>
      </div>
    </div>
  );
};
