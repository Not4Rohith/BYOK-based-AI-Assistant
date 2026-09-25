import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Bot } from 'lucide-react';

import { api } from '../api/client';

interface AITaskbarProps {
  onClick: () => void;
}

export const AITaskbar: React.FC<AITaskbarProps> = ({ onClick }) => {
  const [summary, setSummary] = useState<string>('Analyzing your day...');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await api.getDailySummary();
        if (data && data.summary) {
          setSummary(data.summary);
        } else {
          setSummary("Ready to assist with your day.");
        }
        setLoading(false);
      } catch (error) {
        setSummary("Ready to assist with your day.");
        setLoading(false);
      }
    };

    fetchSummary();
    const intervalId = setInterval(fetchSummary, 60 * 60 * 1000); // Fetch hourly
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div 
      onClick={onClick}
      className="w-full h-14 bg-[#242424] border-t border-white/[0.06] flex items-center px-6 cursor-pointer hover:bg-[#2a2a2a] transition-colors shrink-0 z-40 group"
    >
      <div className="flex items-center space-x-3 w-full">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 flex items-center">
          {loading ? (
            <div className="flex items-center space-x-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating AI summary...</span>
            </div>
          ) : (
            <p className="text-[#e3e3e3] text-sm font-medium flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>{summary}</span>
            </p>
          )}
        </div>
        <div className="text-xs font-semibold text-blue-400/80 group-hover:text-blue-400 transition-colors">
          OPEN CHAT ↗
        </div>
      </div>
    </div>
  );
};
