import React, { useState } from 'react';
import { X } from 'lucide-react';

interface GoogleRepeatModalProps {
  isOpen: boolean;
  initialRule?: string | null;
  initialTime?: string;
  onClose: () => void;
  onSave: (rule: string, time: string | undefined) => void;
}

export const GoogleRepeatModal: React.FC<GoogleRepeatModalProps> = ({
  isOpen,
  initialRule,
  initialTime,
  onClose,
  onSave,
}) => {
  const [interval, setInterval] = useState<number>(1);
  const [unit, setUnit] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [time, setTime] = useState<string>(initialTime || '');
  const [ends, setEnds] = useState<'never' | 'on' | 'after'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [occurrences, setOccurrences] = useState<number>(30);

  if (!isOpen) return null;

  const handleDone = () => {
    const freqMap: Record<string, string> = {
      day: 'DAILY',
      week: 'WEEKLY',
      month: 'MONTHLY',
      year: 'YEARLY',
    };

    let rruleStr = `FREQ=${freqMap[unit]};INTERVAL=${Math.max(1, interval)}`;

    if (ends === 'on' && endDate) {
      const cleanDate = endDate.replace(/-/g, '');
      rruleStr += `;UNTIL=${cleanDate}T235959Z`;
    } else if (ends === 'after' && occurrences > 0) {
      rruleStr += `;COUNT=${occurrences}`;
    }

    onSave(rruleStr, time || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="w-full max-w-sm bg-[#282828] border border-white/10 rounded-3xl shadow-2xl p-6 text-[#e3e3e3] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-white tracking-tight">Repeats every</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interval & Unit Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-center">
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-transparent text-center text-sm text-white font-medium focus:outline-none"
            />
          </div>

          <div className="bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-2 flex items-center">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
              className="w-full bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="day" className="bg-[#282828]">day</option>
              <option value="week" className="bg-[#282828]">week</option>
              <option value="month" className="bg-[#282828]">month</option>
              <option value="year" className="bg-[#282828]">year</option>
            </select>
          </div>
        </div>

        {/* Set Time Input */}
        <div className="bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-2.5 flex items-center space-x-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="Set time"
            className="w-full bg-transparent text-xs text-[#e3e3e3] focus:outline-none"
          />
        </div>

        {/* Ends Section */}
        <div className="space-y-3 pt-1">
          <label className="text-xs font-medium text-slate-300">Ends</label>

          {/* Never Option */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="repeatEnd"
              checked={ends === 'never'}
              onChange={() => setEnds('never')}
              className="w-4 h-4 text-blue-500 accent-blue-500 bg-transparent border-white/20 focus:ring-0"
            />
            <span className="text-xs text-[#e3e3e3]">Never</span>
          </label>

          {/* On Date Option */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-3 cursor-pointer shrink-0">
              <input
                type="radio"
                name="repeatEnd"
                checked={ends === 'on'}
                onChange={() => setEnds('on')}
                className="w-4 h-4 text-blue-500 accent-blue-500 bg-transparent border-white/20 focus:ring-0"
              />
              <span className="text-xs text-[#e3e3e3]">On</span>
            </label>
            <input
              type="date"
              disabled={ends !== 'on'}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`bg-[#1f1f1f] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none ${
                ends !== 'on' ? 'opacity-40 pointer-events-none' : ''
              }`}
            />
          </div>

          {/* After Occurrences Option */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-3 cursor-pointer shrink-0">
              <input
                type="radio"
                name="repeatEnd"
                checked={ends === 'after'}
                onChange={() => setEnds('after')}
                className="w-4 h-4 text-blue-500 accent-blue-500 bg-transparent border-white/20 focus:ring-0"
              />
              <span className="text-xs text-[#e3e3e3]">After</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={1}
                max={999}
                disabled={ends !== 'after'}
                value={occurrences}
                onChange={(e) => setOccurrences(parseInt(e.target.value, 10) || 1)}
                className={`w-16 bg-[#1f1f1f] border border-white/10 rounded-xl px-2 py-1.5 text-center text-xs text-white focus:outline-none ${
                  ends !== 'after' ? 'opacity-40 pointer-events-none' : ''
                }`}
              />
              <span className="text-xs text-slate-400">occurrences</span>
            </div>
          </div>
        </div>

        {/* Action Buttons matching screenshot */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full hover:bg-white/[0.08] text-xs font-medium text-blue-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-6 py-2 bg-[#a8c7fa] hover:bg-[#b8d4ff] text-[#041e49] text-xs font-semibold rounded-full shadow-md transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
