import React from 'react';
import { BarChart2, ScanLine, Shirt, Sparkles, Wand2 } from 'lucide-react';
import { AppTab } from '../types/wardrobe';

interface BottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const navItems: Array<{
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'studio', label: 'Studio', icon: Wand2 },
    { id: 'closet', label: 'Closet', icon: Shirt },
    { id: 'scan', label: 'Scan', icon: ScanLine },
    { id: 'lookbook', label: 'Lookbook', icon: Sparkles },
    { id: 'metrics', label: 'Metrics', icon: BarChart2 },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe pointer-events-none"
    >
      <div className="max-w-lg mx-auto px-5 pb-3 pt-2">
        <div className="pointer-events-auto h-16 rounded-full bg-[#0d0e11]/90 backdrop-blur-2xl px-2 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.75)] flex items-center justify-between ring-1 ring-[#343538]/70">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.id === 'scan') {
              return (
                <div key={item.id} className="flex items-center justify-center px-1">
                  <button
                    type="button"
                    aria-label="Scan garment"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSelectTab('scan')}
                    className={`relative -top-4 w-14 h-14 rounded-full bg-[#caf300] text-[#171e00] shadow-[0_0_24px_-2px_rgba(202,243,0,0.48)] flex items-center justify-center transition-transform active:scale-95 ${
                      isActive ? 'ring-2 ring-white/40' : ''
                    }`}
                  >
                    <Icon className="w-6 h-6 stroke-[2.2]" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0d0e11] ring-1 ring-[#caf300]">
                      <span className="h-2 w-2 rounded-full bg-[#caf300]" />
                    </span>
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-12 transition-all gap-0.5 ${
                  isActive
                    ? 'text-[#caf300] font-semibold'
                    : 'text-[#c9c6c0] hover:text-[#e3e2e6]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#caf300]' : ''}`} />
                <span className="font-mono-tech text-[9px] tracking-wider uppercase whitespace-nowrap">
                  {item.label}
                </span>
                <span
                  className={`h-0.5 rounded-full transition-all duration-300 ${
                    isActive ? 'w-4 bg-[#caf300]' : 'w-0 bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
