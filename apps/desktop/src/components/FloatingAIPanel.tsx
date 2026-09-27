import React, { useState, useEffect } from 'react';
import { Sparkles, X, Send, Bot, RefreshCw, Calendar, Brain, Clock, ChevronDown, ClipboardList } from 'lucide-react';
import { ChatMessage, ChatSession, Memory } from '@ai-task-manager/shared-types';
import { api } from '../api/client';
import { FormattedMarkdown } from './FormattedMarkdown';

interface FloatingAIPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, sessionId?: string) => void;
  onReplan: () => void;
}

export const FloatingAIPanel: React.FC<FloatingAIPanelProps> = ({
  messages,
  onSendMessage,
  onReplan,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isReplanning, setIsReplanning] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>(messages);
  const [showSessionMenu, setShowSessionMenu] = useState(false);

  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [tieredMemories, setTieredMemories] = useState<{ mediumTerm: Memory[]; longTerm: Memory[] }>({
    mediumTerm: [],
    longTerm: [],
  });

  const [showScratchpad, setShowScratchpad] = useState<boolean>(false);
  const [scratchpadData, setScratchpadData] = useState<{
    active: boolean;
    pendingAction?: any;
    dataContent?: string | null;
    timestamp?: string;
  } | null>(null);
  const [isLoadingScratchpad, setIsLoadingScratchpad] = useState<boolean>(false);

  const fetchScratchpad = async () => {
    setIsLoadingScratchpad(true);
    try {
      const res = await api.getScratchpad(selectedSessionId || undefined);
      if (res) {
        setScratchpadData(res);
      }
    } catch (err) {
      console.error('Failed to fetch scratchpad state:', err);
    } finally {
      setIsLoadingScratchpad(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScratchpad();
      const interval = setInterval(fetchScratchpad, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, selectedSessionId]);

  // Load chat sessions and tiered memory when panel opens
  useEffect(() => {
    if (isOpen) {
      loadSessionsAndMemories();
    }
  }, [isOpen]);

  const loadSessionsAndMemories = async () => {
    const fetchedSessions = await api.getChatSessions();
    if (fetchedSessions && fetchedSessions.length > 0) {
      setSessions(fetchedSessions);
      if (!selectedSessionId) {
        setSelectedSessionId(fetchedSessions[0]._id);
      }
    }

    const fetchedMemories = await api.getTieredMemories();
    if (fetchedMemories) {
      setTieredMemories(fetchedMemories);
    }
  };

  // Sync session messages when switching sessions
  useEffect(() => {
    if (selectedSessionId) {
      api.getSessionMessages(selectedSessionId).then((msgs) => {
        if (msgs) setSessionMessages(msgs);
      });
    } else {
      setSessionMessages(messages);
    }
  }, [selectedSessionId, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSendMessage(prompt.trim(), selectedSessionId || undefined);
    setPrompt('');
  };

  const handleReplanClick = () => {
    setIsReplanning(true);
    onReplan();
    setTimeout(() => setIsReplanning(false), 800);
  };

  const currentSessionTitle =
    sessions.find((s) => s._id === selectedSessionId)?.title ||
    `Chat - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <>
      {/* Floating Action Badge */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-full shadow-2xl shadow-blue-500/30 transition-all border border-blue-400/20 z-40"
        >
          <Sparkles className="w-4 h-4" />
          <span>Ask AI Planner</span>
        </button>
      )}

      {/* Floating AI Panel matching Google Tasks Dark Theme (#1f1f1f / #282a2c) */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[440px] h-[540px] bg-[#1f1f1f] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="p-3.5 bg-[#242424] border-b border-white/10 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-[#e3e3e3]">AI Personal Assistant</span>
              </div>

              <div className="flex items-center space-x-1.5">
                {/* Tab Switcher */}
                <div className="flex bg-[#1b1b1b] rounded-lg p-0.5 border border-white/10">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      activeTab === 'chat' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('memory')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 ${
                      activeTab === 'memory' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Brain className="w-3 h-3" />
                    <span>Memory</span>
                  </button>
                </div>

                <button
                  onClick={handleReplanClick}
                  disabled={isReplanning}
                  title="Auto-Replan Day"
                  className="p-1.5 rounded-lg bg-[#1b1b1b] hover:bg-white/10 text-slate-300 text-xs flex items-center space-x-1 border border-white/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isReplanning ? 'animate-spin' : ''}`} />
                  <span>Replan</span>
                </button>

                {/* Scratchpad Button - List Symbol ONLY (no words) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowScratchpad(!showScratchpad);
                      fetchScratchpad();
                    }}
                    title="Scratchpad View"
                    className={`p-1.5 rounded-lg border transition-all relative flex items-center justify-center cursor-pointer ${
                      showScratchpad
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                        : scratchpadData?.active
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-[#1b1b1b] text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <ClipboardList className={`w-3.5 h-3.5 ${scratchpadData?.active ? 'text-amber-400' : 'text-slate-300'}`} />
                    {scratchpadData?.active && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                    )}
                  </button>

                  {/* Scratchpad Inspector Popover */}
                  {showScratchpad && (
                    <div className="absolute right-0 top-9 w-80 bg-[#252528] border border-white/10 rounded-xl shadow-2xl z-50 p-3 font-sans text-xs text-[#e3e3e3] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                        <div className="flex items-center space-x-1.5">
                          <ClipboardList className="w-4 h-4 text-amber-400" />
                          <span className="font-semibold text-[#e3e3e3]">Scratchpad Inspector</span>
                          {scratchpadData?.active ? (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded-full">
                              Empty
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={fetchScratchpad}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                            title="Refresh scratchpad state"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingScratchpad ? 'animate-spin text-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={() => setShowScratchpad(false)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Body Content */}
                      {scratchpadData?.active ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {scratchpadData.pendingAction && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                              <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                                Pending Confirmation Action
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Operation:</span>
                                <span className="font-mono text-amber-200 font-medium">
                                  {scratchpadData.pendingAction.operation}
                                </span>
                              </div>
                              {scratchpadData.pendingAction.tools && (
                                <div className="text-[11px]">
                                  <span className="text-slate-400">Bound Tools: </span>
                                  <span className="font-mono text-slate-200">
                                    {scratchpadData.pendingAction.tools.join(', ')}
                                  </span>
                                </div>
                              )}
                              {scratchpadData.pendingAction.reason && (
                                <div className="text-[11px] text-slate-300 italic pt-1 border-t border-amber-500/20">
                                  "{scratchpadData.pendingAction.reason}"
                                </div>
                              )}
                            </div>
                          )}

                          {scratchpadData.dataContent && (
                            <div className="bg-slate-800/80 border border-white/10 rounded-lg p-2.5 space-y-1">
                              <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">
                                Stored Memory Summary
                              </div>
                              <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-all bg-black/30 p-2 rounded max-h-32 overflow-y-auto">
                                {scratchpadData.dataContent}
                              </pre>
                            </div>
                          )}

                          {/* Raw JSON Debug View */}
                          <details className="text-[11px] text-slate-400">
                            <summary className="cursor-pointer hover:text-slate-200 py-0.5 font-mono text-[10px]">
                              View raw JSON payload
                            </summary>
                            <pre className="mt-1 font-mono text-[9px] text-emerald-400 bg-black/40 p-2 rounded border border-white/5 overflow-x-auto">
                              {JSON.stringify(scratchpadData, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-slate-400 space-y-1.5">
                          <ClipboardList className="w-6 h-6 text-slate-600 mx-auto opacity-50" />
                          <p className="text-[11px] font-medium text-slate-400">Scratchpad is currently empty</p>
                          <p className="text-[10px] text-slate-500 px-2">
                            When high-risk operations or memories are staged, they appear live here.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Session Selector */}
            {activeTab === 'chat' && (
              <div className="relative">
                <button
                  onClick={() => setShowSessionMenu(!showSessionMenu)}
                  className="w-full bg-[#1b1b1b] hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[11px] text-[#e3e3e3] flex items-center justify-between font-medium"
                >
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{currentSessionTitle}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showSessionMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#242424] border border-white/10 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 p-1 space-y-0.5">
                    {sessions.map((s) => (
                      <button
                        key={s._id}
                        onClick={() => {
                          setSelectedSessionId(s._id);
                          setShowSessionMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-between ${
                          s._id === selectedSessionId
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{s.title}</span>
                        <span className="text-[10px] text-slate-500">{s.messageCount || 0} msgs</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Content Body */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs bg-[#1f1f1f]">
                {(sessionMessages.length > 0 ? sessionMessages : messages).map((msg) => (
                  <div
                    key={msg._id}
                    className={`p-3.5 rounded-2xl max-w-[88%] shadow-md ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white ml-auto rounded-tr-none'
                        : 'bg-[#282a2c] border border-white/10 text-[#e3e3e3] rounded-tl-none'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-xs leading-relaxed font-sans">{msg.content}</p>
                    ) : (
                      <FormattedMarkdown content={msg.content} />
                    )}
                  </div>
                ))}
              </div>

              {/* Input Form matching Google Tasks card background (#242424) */}
              <form onSubmit={handleSubmit} className="p-3 bg-[#242424] border-t border-white/10">
                <div className="flex items-center space-x-2 bg-[#1b1b1b] border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500/60 transition-colors">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask AI to plan, update tasks, or chat..."
                    className="flex-1 bg-transparent text-xs text-[#e3e3e3] placeholder-slate-500 focus:outline-none"
                  />
                  <button type="submit" className="text-blue-400 hover:text-blue-300 p-1">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Memory Drawer View */
            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
              {/* Medium-Term Memory Section */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-amber-400 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Medium-Term Context (Current Week / Expiring)</span>
                </h4>
                {tieredMemories.mediumTerm.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic pl-5">No active medium-term events for this week.</p>
                ) : (
                  tieredMemories.mediumTerm.map((m) => (
                    <div key={m._id} className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-amber-300 font-semibold">
                        <span>{m.category.toUpperCase()}</span>
                        <span>Valid until: {m.validUntil || 'End of Week'}</span>
                      </div>
                      <p className="text-slate-200 text-[11px] leading-relaxed">{m.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Long-Term Memory Section */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <h4 className="text-[11px] font-bold text-indigo-400 flex items-center space-x-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Long-Term Personal Profile & Preferences</span>
                </h4>
                {tieredMemories.longTerm.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic pl-5">No long-term memories stored yet.</p>
                ) : (
                  tieredMemories.longTerm.map((m) => (
                    <div key={m._id} className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-indigo-300 font-semibold">
                        <span>{m.category.toUpperCase()}</span>
                        {m.tags && m.tags.length > 0 && <span>#{m.tags.join(' #')}</span>}
                      </div>
                      <p className="text-slate-200 text-[11px] leading-relaxed">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
