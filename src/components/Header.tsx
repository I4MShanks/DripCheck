import React, { useState } from 'react';
import { Bell, CheckCircle2, Droplets, Sparkles, X } from 'lucide-react';
import { BRAND_LOGO_URL, USER_AVATAR_URL } from '../data/wardrobeData';
import { AppTab } from '../types/wardrobe';

interface HeaderProps {
  activeTab: AppTab;
  closetCount: number;
  laundryCount: number;
  savedCount: number;
  onNavigate: (tab: AppTab) => void;
}

const TAB_TITLES: Record<AppTab, string> = {
  studio: 'STUDIO',
  closet: 'CLOSET',
  scan: 'SCAN',
  lookbook: 'LOOKBOOK',
  metrics: 'METRICS',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  closetCount,
  laundryCount,
  savedCount,
  onNavigate,
}) => {
  const [openPanel, setOpenPanel] = useState<'notifications' | 'profile' | null>(null);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-[#121316]/85 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.45)]">
        <div className="max-w-5xl mx-auto h-16 px-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setOpenPanel(null);
              onNavigate('studio');
            }}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <img
              src={BRAND_LOGO_URL}
              alt="Drip Check Studio"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover bg-[#0d0e11]"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-semibold tracking-tight text-[#e3e2e6] uppercase whitespace-nowrap">
                Drip Check
              </span>
              <span className="font-mono-tech text-[9px] font-semibold text-[#caf300] tracking-wider uppercase mt-0.5">
                {TAB_TITLES[activeTab]}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() =>
                setOpenPanel((prev) => (prev === 'notifications' ? null : 'notifications'))
              }
              className={`relative w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                openPanel === 'notifications'
                  ? 'bg-[#caf300] text-[#171e00]'
                  : 'bg-[#292a2d]/70 text-[#c9c6c0] hover:text-[#e3e2e6]'
              }`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {laundryCount > 0 && openPanel !== 'notifications' && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#caf300]" />
              )}
            </button>

            <button
              type="button"
              aria-label="Profile settings"
              onClick={() => setOpenPanel((prev) => (prev === 'profile' ? null : 'profile'))}
              className={`w-11 h-11 flex items-center justify-center rounded-full ring-1 transition-all overflow-hidden ${
                openPanel === 'profile'
                  ? 'ring-[#caf300] bg-[#292a2d]'
                  : 'ring-[#8f9378]/25 bg-[#1f1f23]'
              }`}
            >
              <img
                src={USER_AVATAR_URL}
                alt="User profile"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Dropdown Popover Panel */}
      {openPanel && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpenPanel(null)}
        >
          <div
            className="max-w-5xl mx-auto px-5 pt-18"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ml-auto w-full max-w-xs rounded-[1.5rem] bg-[#1f1f23] border border-white/10 shadow-2xl p-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-[#caf300]">
                  {openPanel === 'notifications' ? 'Studio Alerts' : 'Wardrobe Profile'}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenPanel(null)}
                  className="w-7 h-7 rounded-full bg-[#292a2d] flex items-center justify-center text-[#c9c6c0] hover:text-[#e3e2e6]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {openPanel === 'notifications' ? (
                <div className="flex flex-col gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPanel(null);
                      onNavigate('lookbook');
                    }}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#292a2d]/70 hover:bg-[#292a2d] text-left transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-[#caf300] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-xs font-semibold text-[#e3e2e6]">
                        Issue #48 Curated Fits Ready
                      </p>
                      <p className="font-body text-[11px] text-[#c9c6c0]">
                        98% match for 14°C overcast conditions.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenPanel(null);
                      onNavigate('closet');
                    }}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#292a2d]/70 hover:bg-[#292a2d] text-left transition-colors"
                  >
                    <Droplets className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-xs font-semibold text-[#e3e2e6]">
                        {laundryCount} Item{laundryCount === 1 ? '' : 's'} in Laundry Cycle
                      </p>
                      <p className="font-body text-[11px] text-[#c9c6c0]">
                        Tap to mark garments clean in your Closet.
                      </p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={USER_AVATAR_URL}
                      alt="Profile avatar"
                      className="w-11 h-11 rounded-full object-cover ring-1 ring-[#caf300]/50"
                    />
                    <div>
                      <p className="font-display text-sm font-semibold text-[#e3e2e6]">
                        Kenji Takahashi
                      </p>
                      <p className="font-mono-tech text-[10px] text-[#c9c6c0]">
                        AOMORI / TOKYO · RELAXED UTILITY
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="rounded-xl bg-[#292a2d] p-2 text-center">
                      <span className="font-display text-base font-semibold text-[#e3e2e6] block">
                        {closetCount}
                      </span>
                      <span className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase">
                        Pieces
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#292a2d] p-2 text-center">
                      <span className="font-display text-base font-semibold text-[#caf300] block">
                        {savedCount}
                      </span>
                      <span className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase">
                        Saved
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#292a2d] p-2 text-center">
                      <span className="font-display text-base font-semibold text-[#e3e2e6] block">
                        86%
                      </span>
                      <span className="font-mono-tech text-[9px] text-[#c9c6c0] uppercase">
                        Active
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPanel(null);
                      onNavigate('metrics');
                    }}
                    className="w-full h-9 rounded-full bg-[#caf300] text-[#171e00] font-display text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    View Wardrobe Metrics
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
