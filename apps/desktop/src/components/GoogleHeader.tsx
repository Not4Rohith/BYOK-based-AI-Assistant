import React from 'react';
import { Menu, HelpCircle, Grid, Sparkles, User } from 'lucide-react';

interface GoogleHeaderProps {
  onToggleSidebar: () => void;
  userName: string;
  userAvatar?: string;
}

export const GoogleHeader: React.FC<GoogleHeaderProps> = ({
  onToggleSidebar,
  userName,
  userAvatar,
}) => {
  return (
    <header className="h-16 bg-[#1f1f1f] border-b border-white/[0.06] px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* Left Section: Menu button + Google Tasks Logo */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-full hover:bg-white/[0.08] text-slate-300 transition-colors"
          title="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#4285f4] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <span className="text-xl font-medium text-[#e3e3e3] tracking-normal font-sans">Tasks</span>
        </div>
      </div>

      {/* Right Section: Help, Apps, User Avatar */}
      <div className="flex items-center space-x-2">


        <button
          className="p-2 rounded-full hover:bg-white/[0.08] text-[#c4c7c5] transition-colors"
          title="Support"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <button
          className="p-2 rounded-full hover:bg-white/[0.08] text-[#c4c7c5] transition-colors"
          title="Google apps"
        >
          <Grid className="w-5 h-5" />
        </button>

        <div className="pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs border border-white/20 shadow">
            {userName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
};
