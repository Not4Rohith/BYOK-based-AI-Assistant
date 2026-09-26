import React from 'react';
import { Menu, RefreshCw } from 'lucide-react';

interface GoogleHeaderProps {
  onToggleSidebar: () => void;
  userName: string;
  userAvatar?: string;
  isConnected?: boolean;
  isCheckingHealth?: boolean;
  onCheckHealth?: () => void;
}

export const GoogleHeader: React.FC<GoogleHeaderProps> = ({
  onToggleSidebar,
  userName,
  userAvatar,
  isConnected = true,
  isCheckingHealth = false,
  onCheckHealth,
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

      {/* Right Section: Backend Connection Status + User Avatar */}
      <div className="flex items-center space-x-3">
        {/* Render Connection Status Button */}
        <button
          onClick={onCheckHealth}
          title={
            isConnected
              ? 'Render Backend: Connected (Click to re-check connection status)'
              : 'Render Backend: Offline (Click to retry connection)'
          }
          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center space-x-2 border transition-all cursor-pointer shadow-sm ${
            isConnected
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isCheckingHealth
                ? 'bg-amber-400 animate-ping'
                : isConnected
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
            }`}
          />
          <span className="font-semibold tracking-wide flex items-center space-x-1">
            <span>{isCheckingHealth ? 'Checking...' : isConnected ? 'Render Connected' : 'Render Offline'}</span>
            {isCheckingHealth && <RefreshCw className="w-3 h-3 animate-spin ml-1 inline text-amber-400" />}
          </span>
        </button>

        <div className="pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs border border-white/20 shadow">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

