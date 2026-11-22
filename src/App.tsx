import { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { ClosetView } from './components/ClosetView';
import { Header } from './components/Header';
import { LookbookView } from './components/LookbookView';
import { MetricsView } from './components/MetricsView';
import { ScanView } from './components/ScanView';
import { StudioView } from './components/StudioView';
import {
  CURATED_LOOKS,
  DEFAULT_OUTFIT,
  INITIAL_GARMENTS,
  INITIAL_WORN_LOG,
  SHUFFLE_PRESETS,
} from './data/wardrobeData';
import {
  AppTab,
  CuratedLook,
  GarmentItem,
  MannequinOutfit,
  WornLogEntry,
} from './types/wardrobe';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [garments, setGarments] = useState<GarmentItem[]>(INITIAL_GARMENTS);
  const [outfit, setOutfit] = useState<MannequinOutfit>(DEFAULT_OUTFIT);
  const [looks, setLooks] = useState<CuratedLook[]>(CURATED_LOOKS);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [bookmarkedLookIds, setBookmarkedLookIds] = useState<string[]>(['look-urban-minimalist']);
  const [rotationLookIds, setRotationLookIds] = useState<string[]>([]);
  const [wornLog, setWornLog] = useState<WornLogEntry[]>(INITIAL_WORN_LOG);
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  const laundryCount = useMemo(
    () => garments.filter((g) => g.status === 'laundry').length,
    [garments]
  );

  const computePaletteFromIds = useCallback(
    (jacketId: string | null, topId: string, bottomId: string, shoesId: string) => {
      const ids = [jacketId, topId, bottomId, shoesId].filter(Boolean) as string[];
      return ids
        .map((id) => garments.find((g) => g.id === id)?.colorHex)
        .filter((hex): hex is string => Boolean(hex));
    },
    [garments]
  );

  const handleSelectGarment = useCallback(
    (item: GarmentItem) => {
      setOutfit((prev) => {
        const nextJacketId = item.slot === 'jacket' ? item.id : prev.jacketId;
        const nextTopId = item.slot === 'top' ? item.id : prev.topId;
        const nextBottomId = item.slot === 'bottom' ? item.id : prev.bottomId;
        const nextShoesId = item.slot === 'shoes' ? item.id : prev.shoesId;
        return {
          ...prev,
          jacketId: nextJacketId,
          topId: nextTopId,
          bottomId: nextBottomId,
          shoesId: nextShoesId,
          paletteColors: computePaletteFromIds(nextJacketId, nextTopId, nextBottomId, nextShoesId),
          matchScore: Math.min(99, Math.max(91, item.matchBoost)),
        };
      });
      showToast(`Equipped ${item.name} on 3D Mannequin`);
    },
    [computePaletteFromIds, showToast]
  );

  const handleRemoveJacket = useCallback(() => {
    setOutfit((prev) => ({
      ...prev,
      jacketId: null,
      paletteColors: computePaletteFromIds(null, prev.topId, prev.bottomId, prev.shoesId),
    }));
    showToast('Removed outer jacket layer');
  }, [computePaletteFromIds, showToast]);

  const handleShuffleFit = useCallback(() => {
    const preset = SHUFFLE_PRESETS[shuffleIdx % SHUFFLE_PRESETS.length];
    setShuffleIdx((prev) => prev + 1);
    setOutfit((prev) => ({
      ...prev,
      id: `shuffle-${Date.now()}`,
      title: preset.title,
      harmonyTitle: preset.harmonyTitle,
      harmonySubtitle: preset.harmonySubtitle,
      matchScore: preset.matchScore,
      fitBalance: preset.fitBalance,
      paletteColors: preset.paletteColors,
      jacketId: preset.jacketId,
      topId: preset.topId,
      bottomId: preset.bottomId,
      shoesId: preset.shoesId,
    }));
    showToast(`Algorithmic Shuffle: ${preset.matchScore}% ${preset.title}`);
  }, [shuffleIdx, showToast]);

  const handleWearToday = useCallback(() => {
    const equippedIds = new Set(
      [outfit.jacketId, outfit.topId, outfit.bottomId, outfit.shoesId].filter(Boolean)
    );
    setGarments((prev) =>
      prev.map((g) => (equippedIds.has(g.id) ? { ...g, wearCount: g.wearCount + 1 } : g))
    );
    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    setWornLog((prev) => [
      {
        id: `log-${Date.now()}`,
        dateLabel: `Today · ${todayStr}`,
        outfitTitle: outfit.title,
        matchScore: outfit.matchScore,
        itemsCount: equippedIds.size,
      },
      ...prev,
    ]);
    showToast(`Logged "${outfit.title}" to Outfit Calendar`);
  }, [outfit, showToast]);

  const handleSaveToLookbook = useCallback(() => {
    if (savedOutfitIds.includes(outfit.id)) {
      showToast('Already archived in Lookbook');
      return;
    }
    const jacket = garments.find((g) => g.id === outfit.jacketId);
    const top = garments.find((g) => g.id === outfit.topId) || garments[3];
    const bottom = garments.find((g) => g.id === outfit.bottomId) || garments[6];
    const shoes = garments.find((g) => g.id === outfit.shoesId) || garments[8];

    const newLook: CuratedLook = {
      id: `look-saved-${Date.now()}`,
      issueIndex: `Look 0${looks.length + 1} • Studio Archive`,
      categoryTag: 'STUDIO ARCHIVE',
      feedCategory: 'for-you',
      title: outfit.title,
      matchScore: outfit.matchScore,
      paletteColors: outfit.paletteColors,
      paletteLabel: 'Studio Palette',
      hashtags: ['#StudioSaved', '#3DMannequin', '#ObsidianCitron'],
      outfit: {
        jacketId: outfit.jacketId,
        topId: outfit.topId,
        bottomId: outfit.bottomId,
        shoesId: outfit.shoesId,
        title: outfit.title,
        harmonyTitle: outfit.harmonyTitle,
        harmonySubtitle: outfit.harmonySubtitle,
      },
      images: {
        primary: jacket ? jacket.image : top.image,
        primaryLabel: `01 / ${jacket ? jacket.shortLabel : top.shortLabel}`,
        secondaryTop: bottom.image,
        secondaryTopLabel: `02 / ${bottom.shortLabel}`,
        secondaryBottom: shoes.image,
        secondaryBottomLabel: `03 / ${shoes.shortLabel}`,
      },
      layout: 'trio',
    };

    setLooks((prev) => [newLook, ...prev]);
    setSavedOutfitIds((prev) => [...prev, outfit.id]);
    setBookmarkedLookIds((prev) => [...prev, newLook.id]);
    showToast(`Archived "${outfit.title}" in Lookbook`);
  }, [garments, looks.length, outfit, savedOutfitIds, showToast]);

  const handleTryOnFromCloset = useCallback(
    (item: GarmentItem) => {
      handleSelectGarment(item);
      setActiveTab('studio');
    },
    [handleSelectGarment]
  );

  const handleToggleLaundry = useCallback(
    (id: string) => {
      setGarments((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          const nextStatus = g.status === 'laundry' ? 'clean' : 'laundry';
          showToast(
            nextStatus === 'clean'
              ? `${g.name} marked Clean & Ready`
              : `${g.name} moved to Laundry`
          );
          return { ...g, status: nextStatus };
        })
      );
    },
    [showToast]
  );

  const handleToggleFavorite = useCallback((id: string) => {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g))
    );
  }, []);

  const handleSaveScannedGarment = useCallback(
    (newItem: GarmentItem) => {
      setGarments((prev) => [newItem, ...prev]);
      showToast(`${newItem.name} saved to Closet & Studio Rack`);
      setActiveTab('closet');
    },
    [showToast]
  );

  const handleWearLookOnMannequin = useCallback(
    (look: CuratedLook) => {
      setOutfit((prev) => ({
        ...prev,
        id: look.id,
        title: look.outfit.title,
        harmonyTitle: look.outfit.harmonyTitle,
        harmonySubtitle: look.outfit.harmonySubtitle,
        matchScore: look.matchScore,
        paletteColors: look.paletteColors,
        jacketId: look.outfit.jacketId,
        topId: look.outfit.topId,
        bottomId: look.outfit.bottomId,
        shoesId: look.outfit.shoesId,
      }));
      setActiveTab('studio');
      showToast(`Loaded "${look.title}" onto 3D Mannequin`);
    },
    [showToast]
  );

  const handleToggleBookmark = useCallback(
    (id: string) => {
      setBookmarkedLookIds((prev) => {
        const exists = prev.includes(id);
        showToast(exists ? 'Removed bookmark' : 'Saved look to bookmarks');
        return exists ? prev.filter((item) => item !== id) : [...prev, id];
      });
    },
    [showToast]
  );

  const handleAddToRotation = useCallback(
    (look: CuratedLook) => {
      setRotationLookIds((prev) => {
        const exists = prev.includes(look.id);
        showToast(
          exists
            ? `Removed "${look.title}" from weekly rotation`
            : `Added "${look.title}" to weekly rotation`
        );
        return exists ? prev.filter((item) => item !== look.id) : [...prev, look.id];
      });
    },
    [showToast]
  );

  return (
    <div className="bg-[#121316] text-[#e3e2e6] min-h-screen flex flex-col">
      <Header
        activeTab={activeTab}
        closetCount={garments.length}
        laundryCount={laundryCount}
        savedCount={bookmarkedLookIds.length}
        onNavigate={setActiveTab}
      />

      {/* Toast Notification */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${
          toastMsg ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="px-4 py-2 rounded-full bg-[#343538]/95 backdrop-blur-xl text-[#e3e2e6] shadow-2xl flex items-center gap-2 border border-white/10 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 text-[#caf300] shrink-0" />
          <span className="font-mono-tech text-[11px] tracking-tight">{toastMsg}</span>
        </div>
      </div>

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-28 bg-[#121316]">
        {activeTab === 'studio' && (
          <StudioView
            garments={garments}
            outfit={outfit}
            isSaved={savedOutfitIds.includes(outfit.id)}
            onSelectGarment={handleSelectGarment}
            onRemoveJacket={handleRemoveJacket}
            onShuffleFit={handleShuffleFit}
            onWearToday={handleWearToday}
            onSaveToLookbook={handleSaveToLookbook}
            onNavigate={setActiveTab}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'closet' && (
          <ClosetView
            garments={garments}
            onTryOn={handleTryOnFromCloset}
            onToggleLaundry={handleToggleLaundry}
            onToggleFavorite={handleToggleFavorite}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'scan' && (
          <ScanView
            onSaveGarment={handleSaveScannedGarment}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'lookbook' && (
          <LookbookView
            looks={looks}
            bookmarkedIds={bookmarkedLookIds}
            rotationIds={rotationLookIds}
            onWearOnMannequin={handleWearLookOnMannequin}
            onToggleBookmark={handleToggleBookmark}
            onAddToRotation={handleAddToRotation}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsView
            garments={garments}
            wornLog={wornLog}
            onNavigate={setActiveTab}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}
