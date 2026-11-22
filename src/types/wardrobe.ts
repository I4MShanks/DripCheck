export type AppTab = 'studio' | 'closet' | 'scan' | 'lookbook' | 'metrics';

export type GarmentCategory = 'jackets' | 'tops' | 'pants' | 'shoes' | 'accessories';

export type GarmentSlot = 'jacket' | 'top' | 'bottom' | 'shoes';

export type FabricStyle = 'corduroy' | 'ripstop' | 'knit' | 'cotton' | 'denim' | 'cargo' | 'leather';

export interface GarmentItem {
  id: string;
  name: string;
  shortLabel: string;
  brand: string;
  price: number;
  category: GarmentCategory;
  slot: GarmentSlot;
  colorName: string;
  colorHex: string;
  paletteKey: 'mustard' | 'blue' | 'slate' | 'black' | 'ecru' | 'olive';
  fabric: FabricStyle;
  fabricLabel: string;
  image: string;
  status: 'clean' | 'ready' | 'laundry';
  wearCount: number;
  matchBoost: number;
  favorite?: boolean;
  season: string;
}

export interface MannequinOutfit {
  id: string;
  title: string;
  weatherLabel: string;
  silhouetteLabel: string;
  canvasId: string;
  matchScore: number;
  fitBalance: number;
  harmonyTitle: string;
  harmonySubtitle: string;
  paletteColors: string[];
  jacketId: string | null;
  topId: string;
  bottomId: string;
  shoesId: string;
}

export interface CuratedLook {
  id: string;
  issueIndex: string;
  categoryTag: string;
  feedCategory: 'for-you' | 'streetwear' | 'office' | 'dinner' | 'rainy';
  title: string;
  matchScore: number;
  paletteColors: string[];
  paletteLabel: string;
  hashtags: string[];
  stylistNote?: string;
  prepTime?: string;
  outfit: {
    jacketId: string | null;
    topId: string;
    bottomId: string;
    shoesId: string;
    title: string;
    harmonyTitle: string;
    harmonySubtitle: string;
  };
  images: {
    primary: string;
    primaryLabel: string;
    secondaryTop?: string;
    secondaryTopLabel?: string;
    secondaryBottom?: string;
    secondaryBottomLabel?: string;
  };
  layout: 'trio' | 'duo' | 'wide';
}

export interface WornLogEntry {
  id: string;
  dateLabel: string;
  outfitTitle: string;
  matchScore: number;
  itemsCount: number;
}
