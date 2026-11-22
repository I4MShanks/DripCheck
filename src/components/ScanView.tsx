import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Crosshair,
  FlipHorizontal,
  Grid,
  Image as ImageIcon,
  Info,
  Layers,
  RefreshCw,
  ScanLine,
  SlidersHorizontal,
  Zap,
  ZapOff,
} from 'lucide-react';
import { GARMENT_IMAGES } from '../data/wardrobeData';
import { GarmentCategory, GarmentItem } from '../types/wardrobe';

interface ScanViewProps {
  onSaveGarment: (newItem: GarmentItem) => void;
  onShowToast: (msg: string) => void;
}

interface ScanPreset {
  name: string;
  shortLabel: string;
  brand: string;
  categoryLabel: string;
  category: GarmentCategory;
  slot: GarmentItem['slot'];
  colorName: string;
  colorHex: string;
  paletteKey: GarmentItem['paletteKey'];
  fabric: GarmentItem['fabric'];
  fabricLabel: string;
  season: string;
  layer: string;
  price: number;
  image: string;
  dripId: string;
}

const SCAN_PRESETS: ScanPreset[] = [
  {
    name: 'Forest Corduroy Overshirt',
    shortLabel: 'Forest Corduroy',
    brand: 'A.P.C. Studio',
    categoryLabel: 'Overshirt / Light Jacket',
    category: 'jackets',
    slot: 'jacket',
    colorName: 'Forest Moss',
    colorHex: '#3D5A45',
    paletteKey: 'olive',
    fabric: 'corduroy',
    fabricLabel: 'Corduroy Rib',
    season: 'Fall / Spring',
    layer: 'Mid-layer',
    price: 135,
    image: GARMENT_IMAGES.forestCordScan,
    dripId: '#8092',
  },
  {
    name: 'Technical Field Shell',
    shortLabel: 'Field Shell',
    brand: 'Nanamica',
    categoryLabel: 'Technical Shell / Outerwear',
    category: 'jackets',
    slot: 'jacket',
    colorName: 'Muted Olive',
    colorHex: '#556144',
    paletteKey: 'olive',
    fabric: 'ripstop',
    fabricLabel: '3L Ripstop',
    season: 'All-Weather',
    layer: 'Outer-shell',
    price: 210,
    image: GARMENT_IMAGES.oliveShell,
    dripId: '#8093',
  },
  {
    name: 'Ecru Ribbed Zip Knit',
    shortLabel: 'Ribbed Zip Knit',
    brand: 'Our Legacy',
    categoryLabel: 'Heavy Knit / Cardigan',
    category: 'jackets',
    slot: 'jacket',
    colorName: 'Warm Ecru',
    colorHex: '#E5DFCE',
    paletteKey: 'ecru',
    fabric: 'knit',
    fabricLabel: 'Gauge Rib Wool',
    season: 'Fall / Winter',
    layer: 'Mid-layer',
    price: 180,
    image: GARMENT_IMAGES.ecruKnit,
    dripId: '#8094',
  },
];

export const ScanView: React.FC<ScanViewProps> = ({ onSaveGarment, onShowToast }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [editingTags, setEditingTags] = useState(false);

  const activePreset = SCAN_PRESETS[presetIdx];
  const [draftName, setDraftName] = useState(activePreset.name);
  const [draftBrand, setDraftBrand] = useState(activePreset.brand);
  const [draftCategory, setDraftCategory] = useState<GarmentCategory>(activePreset.category);
  const [draftColor, setDraftColor] = useState(activePreset.colorName);

  const syncDraftToPreset = (nextIdx: number) => {
    const p = SCAN_PRESETS[nextIdx];
    setPresetIdx(nextIdx);
    setDraftName(p.name);
    setDraftBrand(p.brand);
    setDraftCategory(p.category);
    setDraftColor(p.colorName);
  };

  const handleShutter = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onShowToast('Drip Analyzed: 99.4% Confidence Lock');
    }, 650);
  };

  const handleFlipPreset = () => {
    setCustomImage(null);
    const nextIdx = (presetIdx + 1) % SCAN_PRESETS.length;
    syncDraftToPreset(nextIdx);
    onShowToast(`Viewfinder target: ${SCAN_PRESETS[nextIdx].name}`);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImage(reader.result);
        setDraftName(file.name.replace(/\.[^/.]+$/, '') || 'Scanned Garment');
        setIsScanning(true);
        setTimeout(() => {
          setIsScanning(false);
          onShowToast('AI Edge Detection locked on uploaded garment');
        }, 550);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const slotMap: Record<GarmentCategory, GarmentItem['slot']> = {
      jackets: 'jacket',
      tops: 'top',
      pants: 'bottom',
      shoes: 'shoes',
      accessories: 'jacket',
    };

    const newItem: GarmentItem = {
      id: `scan-${Date.now()}`,
      name: draftName.trim() || activePreset.name,
      shortLabel: (draftName.trim() || activePreset.shortLabel).slice(0, 20),
      brand: draftBrand.trim() || activePreset.brand,
      price: activePreset.price,
      category: draftCategory,
      slot: slotMap[draftCategory],
      colorName: draftColor.trim() || activePreset.colorName,
      colorHex: activePreset.colorHex,
      paletteKey: activePreset.paletteKey,
      fabric: activePreset.fabric,
      fabricLabel: activePreset.fabricLabel,
      image: customImage || activePreset.image,
      status: 'clean',
      wearCount: 1,
      matchBoost: 99,
      favorite: true,
      season: activePreset.season,
    };

    onSaveGarment(newItem);
  };

  const displayImage = customImage || activePreset.image;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto relative select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadFile}
      />

      {/* Top Floating Guidance Pill */}
      <div className="px-5 pt-1 pb-2.5 flex justify-center">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0d0e11]/90 shadow-md">
          <Info className="w-4 h-4 text-[#caf300] shrink-0" />
          <span className="font-mono-tech text-[10px] text-[#e3e2e6] tracking-wide">
            Lay flat or hang against neutral wall for best cut
          </span>
        </div>
      </div>

      {/* Responsive Desktop Split / Mobile Stack */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:px-5 lg:items-start">
        {/* Main Viewfinder Section */}
        <div className="mx-5 lg:mx-0 lg:col-span-6 relative rounded-[2rem] overflow-hidden bg-[#0d0e11] shadow-2xl h-[410px] flex items-center justify-center">
          <img
            src={displayImage}
            alt={draftName}
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
              flashOn ? 'brightness-100' : 'brightness-75'
            } ${isScanning ? 'scale-[1.03]' : 'scale-100'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e11]/60 via-transparent to-[#0d0e11]/85 pointer-events-none" />

          {/* Optional Grid Lines */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-white/10" />
              ))}
            </div>
          )}

          {/* HUD Crosshairs & Metadata */}
          <div className="absolute inset-0 pointer-events-none p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[#c9c6c0]/80">
              <span className="font-mono-tech text-[9px] font-semibold">ISO 100 • 28MM</span>
              <span className="font-mono-tech text-[9px] font-semibold">RAW • AI ON</span>
            </div>
            <div className="self-center flex items-center justify-center">
              <Crosshair className="w-6 h-6 text-[#c9c6c0]/50" />
            </div>
            <div className="flex justify-between items-center text-[#c9c6c0]/80">
              <span className="font-mono-tech text-[9px] font-semibold">FPS 60</span>
              <span className="font-mono-tech text-[9px] font-semibold">
                {showGrid ? 'GRID LOCKED' : 'FREE FRAME'}
              </span>
            </div>
          </div>

          {/* Illuminated AI Bounding Box & Target Brackets */}
          <div className="relative w-64 h-76 rounded-2xl z-10 flex flex-col justify-between p-3 pointer-events-none">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-[#caf300] rounded-tl-sm shadow-[0_0_12px_rgba(202,243,0,0.6)]" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-[#caf300] rounded-tr-sm shadow-[0_0_12px_rgba(202,243,0,0.6)]" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-[#caf300] rounded-bl-sm shadow-[0_0_12px_rgba(202,243,0,0.6)]" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-[#caf300] rounded-br-sm shadow-[0_0_12px_rgba(202,243,0,0.6)]" />

            {/* Scanning Laser Beam */}
            <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-[#caf300] to-transparent shadow-[0_0_16px_rgba(202,243,0,0.9)] animate-scan-beam" />

            <div className="self-start px-2.5 py-0.5 rounded-full bg-[#0d0e11]/90 flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#caf300]" />
              <span className="font-mono-tech text-[9px] font-semibold text-[#caf300] uppercase tracking-wider">
                {isScanning ? 'SCANNING...' : 'LOCKED 99.4%'}
              </span>
            </div>

            <div className="self-end px-2.5 py-0.5 rounded-full bg-[#0d0e11]/90 flex items-center gap-1 shadow-md">
              <span className="font-mono-tech text-[9px] font-semibold text-[#e3e2e6]">
                DRIP_ID: {activePreset.dripId}
              </span>
            </div>
          </div>

          {/* Active Scanning Status Pill */}
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 w-max max-w-[92%]">
            <div className="px-3.5 py-1.5 rounded-full bg-[#0d0e11]/92 flex items-center gap-1.5 shadow-lg">
              <RefreshCw
                className="w-3.5 h-3.5 text-[#caf300] animate-spin"
                style={{ animationDuration: isScanning ? '0.8s' : '4s' }}
              />
              <span className="font-mono-tech text-[9px] text-[#caf300] font-semibold tracking-wide">
                AI EDGE DETECTION ACTIVE
              </span>
              <span className="text-[#c9c6c0]/50 text-[10px]">•</span>
              <span className="font-mono-tech text-[9px] font-semibold text-[#e3e2e6]">
                BG REMOVED
              </span>
            </div>
          </div>

          {/* Camera Quick Controls Overlay */}
          <div className="absolute top-3.5 right-3.5 flex flex-col gap-2 z-20">
            <button
              type="button"
              aria-label="Toggle Flash"
              onClick={() => setFlashOn((prev) => !prev)}
              className={`w-10 h-10 rounded-full bg-[#0d0e11]/85 flex items-center justify-center active:scale-95 shadow-md ${
                flashOn ? 'text-[#caf300]' : 'text-[#c9c6c0]'
              }`}
            >
              {flashOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              aria-label="Toggle Grid"
              onClick={() => setShowGrid((prev) => !prev)}
              className={`w-10 h-10 rounded-full bg-[#0d0e11]/85 flex items-center justify-center active:scale-95 shadow-md ${
                showGrid ? 'text-[#caf300]' : 'text-[#c9c6c0]'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Live Garment Analysis Drawer + Shutter Deck */}
        <div className="px-5 lg:px-0 lg:col-span-6 mt-4 lg:mt-0 flex flex-col gap-4">
          <div className="p-4 rounded-[2rem] bg-[#1b1b1f] shadow-xl overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3 mb-3.5 bg-[#1f1f23]/60 -mx-4 -mt-4 p-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#caf300] shadow-[0_0_8px_rgba(202,243,0,0.8)]" />
                <span className="font-display text-base font-medium text-[#e3e2e6] uppercase tracking-tight">
                  Auto Extraction
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#caf300] text-[#171e00] font-mono-tech text-[10px] font-semibold tracking-wider">
                99% CONFIDENCE
              </span>
            </div>

            {/* Cutout Preview & Attributes */}
            <div className="flex gap-4 items-center">
              <div className="relative w-28 h-32 rounded-2xl overflow-hidden bg-[radial-gradient(#292a2d_1px,transparent_1px)] [background-size:8px_8px] bg-[#0d0e11] flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src={displayImage}
                  alt="Extracted garment cutout"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover p-1.5 rounded-2xl"
                />
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#0d0e11]/90">
                  <span className="font-mono-tech text-[9px] font-semibold text-[#caf300]">
                    PNG CUT
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col">
                  <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase">
                    Category
                  </span>
                  <span className="font-display text-base text-[#e3e2e6] font-semibold truncate">
                    {activePreset.categoryLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase">
                      Color
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: activePreset.colorHex }}
                      />
                      <span className="font-body text-xs text-[#e3e2e6] truncate">
                        {draftColor}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] uppercase">
                      Fabric
                    </span>
                    <span className="font-body text-xs text-[#e3e2e6] truncate mt-0.5">
                      {activePreset.fabricLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5 text-[#c9c6c0]" />
                    <span className="font-body text-xs text-[#c9c6c0]">{activePreset.season}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#caf300]" />
                    <span className="font-body text-xs text-[#e3e2e6] font-medium">
                      {activePreset.layer}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inline Editable Tags Form */}
            {editingTags && (
              <div className="mt-3.5 pt-3 border-t border-white/10 grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase block mb-1">
                    Garment Name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-[#292a2d] text-xs text-[#e3e2e6] focus:outline-none focus:ring-1 focus:ring-[#caf300]"
                  />
                </div>
                <div>
                  <label className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase block mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={draftBrand}
                    onChange={(e) => setDraftBrand(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-[#292a2d] text-xs text-[#e3e2e6] focus:outline-none focus:ring-1 focus:ring-[#caf300]"
                  />
                </div>
                <div>
                  <label className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase block mb-1">
                    Category
                  </label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as GarmentCategory)}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#292a2d] text-xs text-[#e3e2e6] focus:outline-none focus:ring-1 focus:ring-[#caf300]"
                  >
                    <option value="jackets">Outerwear / Jacket</option>
                    <option value="tops">Tops / Tee</option>
                    <option value="pants">Bottoms / Pants</option>
                    <option value="shoes">Footwear / Shoes</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase block mb-1">
                    Color Label
                  </label>
                  <input
                    type="text"
                    value={draftColor}
                    onChange={(e) => setDraftColor(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-[#292a2d] text-xs text-[#e3e2e6] focus:outline-none focus:ring-1 focus:ring-[#caf300]"
                  />
                </div>
              </div>
            )}

            {/* Action Row */}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setEditingTags((prev) => !prev)}
                className="flex-1 h-11 rounded-full bg-[#343538] text-[#e3e2e6] font-display text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{editingTags ? 'Done Editing' : 'Edit Tags'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex-[1.4] h-11 rounded-full bg-[#caf300] hover:bg-[#b0d500] text-[#171e00] font-display text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 shadow-[0_0_16px_rgba(202,243,0,0.3)] transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save to Closet</span>
              </button>
            </div>
          </div>

          {/* Camera Shutter Controls Deck */}
          <div className="p-4 rounded-[2.5rem] bg-[#0d0e11]/90 flex items-center justify-between shadow-2xl">
            <button
              type="button"
              aria-label="Upload from gallery"
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-[#292a2d]/80 text-[#e3e2e6] hover:bg-[#343538] flex items-center justify-center active:scale-90 transition-transform"
              title="Upload garment photo"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <div className="relative flex items-center justify-center">
              <button
                type="button"
                aria-label="Capture garment"
                onClick={handleShutter}
                className="relative w-20 h-20 rounded-full bg-[#0d0e11] p-1.5 shadow-[0_0_28px_rgba(202,243,0,0.45)] active:scale-95 transition-transform"
              >
                <div className="w-full h-full rounded-full bg-[#caf300] p-1 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#0d0e11] flex items-center justify-center">
                    <ScanLine className="w-6 h-6 text-[#caf300]" />
                  </div>
                </div>
              </button>
            </div>

            <button
              type="button"
              aria-label="Cycle garment sample"
              onClick={handleFlipPreset}
              className="w-12 h-12 rounded-full bg-[#292a2d]/80 text-[#e3e2e6] hover:bg-[#343538] flex items-center justify-center active:scale-90 transition-transform"
              title="Switch viewfinder garment"
            >
              <FlipHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
