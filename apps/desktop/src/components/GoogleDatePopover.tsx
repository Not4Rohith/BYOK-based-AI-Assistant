import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, X, Check, Trash2 } from 'lucide-react';

interface GoogleDatePopoverProps {
  isOpen: boolean;
  initialDate?: string | null;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onSave: (scheduledStart: string | null) => void;
}

export const GoogleDatePopover: React.FC<GoogleDatePopoverProps> = ({
  isOpen,
  initialDate,
  position,
  onClose,
  onSave,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (!initialDate) return new Date().toISOString().substring(0, 10);
    return new Date(initialDate).toISOString().substring(0, 10);
  });

  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (!initialDate) return '09:00';
    const d = new Date(initialDate);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  const setQuickDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const setNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay() + 1) % 7 || 7));
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  const handleSave = () => {
    if (!selectedDate) {
      onSave(null);
    } else {
      const timeStr = selectedTime || '09:00';
      const isoStr = new Date(`${selectedDate}T${timeStr}:00`).toISOString();
      onSave(isoStr);
    }
    onClose();
  };

  const handleClear = () => {
    onSave(null);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      style={{ top: position.top, left: position.left }}
      className="fixed w-72 bg-[#282828] border border-white/10 rounded-2xl shadow-2xl p-4 z-50 text-xs text-[#e3e3e3] space-y-4 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <span className="font-medium text-white flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>Date & time</span>
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/[0.08] text-slate-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Choice Pills */}
      <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
        <button
          onClick={() => setQuickDate(0)}
          className="px-2.5 py-1 bg-[#1f1f1f] hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-[11px] font-medium transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => setQuickDate(1)}
          className="px-2.5 py-1 bg-[#1f1f1f] hover:bg-white/[0.08] text-slate-300 border border-white/10 rounded-full text-[11px] font-medium transition-colors"
        >
          Tomorrow
        </button>
        <button
          onClick={setNextWeek}
          className="px-2.5 py-1 bg-[#1f1f1f] hover:bg-white/[0.08] text-slate-300 border border-white/10 rounded-full text-[11px] font-medium transition-colors"
        >
          Next week
        </button>
      </div>

      {/* Custom Date & Time Picker */}
      <div className="space-y-2 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Time</label>
          <input
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
        <button
          onClick={handleClear}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#a8c7fa] hover:bg-[#b8d4ff] text-[#041e49] text-xs font-semibold rounded-full shadow transition-all active:scale-95"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
};
