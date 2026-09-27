import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, ArrowLeft, Send, Info, X, Database, Cpu, Wrench, Sparkles, MessageSquare, History, Calendar, CheckSquare, Brain, ClipboardList, RefreshCw } from 'lucide-react';
import { ChatMessage, ChatSession } from '@ai-task-manager/shared-types';
import { FormattedMarkdown } from './FormattedMarkdown';
import { api } from '../api/client';

interface FullScreenChatProps {
  onBack: () => void;
  messages: ChatMessage[];
  sessions: ChatSession[];
  onSendMessage: (text: string, sessionId?: string) => void;
}

export const FullScreenChat: React.FC<FullScreenChatProps> = ({
  onBack,
  messages,
  sessions,
  onSendMessage
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>(messages);
  const [showMobileSessions, setShowMobileSessions] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef<boolean>(true);
  const userJustSentRef = useRef<boolean>(false);

  const [detailModalMsg, setDetailModalMsg] = useState<ChatMessage | null>(null);

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
    fetchScratchpad();
    const interval = setInterval(fetchScratchpad, 3000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionMessages(messages);
    } else {
      api.getSessionMessages(selectedSessionId).then((data) => {
        if (data) setSessionMessages(data);
      });
    }
  }, [messages, selectedSessionId]);

  // Handle smart auto-scroll without snapping when user is reading past history
  useEffect(() => {
    if (userJustSentRef.current || isAutoScrollEnabled.current) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      userJustSentRef.current = false;
    }
  }, [sessionMessages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // User is considered at bottom if within 100px of container bottom
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
    isAutoScrollEnabled.current = isAtBottom;
  };

  const handleSubmit = (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim()) return;
    userJustSentRef.current = true;
    isAutoScrollEnabled.current = true;
    onSendMessage(textToSend.trim(), selectedSessionId || undefined);
    if (!customPrompt) setPrompt('');
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full w-full bg-[#1E1E1E] text-white relative font-sans overflow-hidden">
      {/* Left Sidebar - Chat Sessions History (Desktop & Mobile Drawer) */}
      <div
        className={`w-72 bg-[#141414] border-r border-white/10 flex flex-col z-30 transition-all duration-200 ${showMobileSessions ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex'
          }`}
      >
        <div className="p-4 pt-12 md:pt-4 border-b border-white/10 flex items-center justify-between text-[#e3e3e3]">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-sm">AI Chat Sessions</h2>
          </div>
          <button
            onClick={() => setShowMobileSessions(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-xs text-slate-500 p-3 text-center italic">No saved sessions yet</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session._id}
                onClick={() => {
                  userJustSentRef.current = true;
                  setSelectedSessionId(session._id);
                  setShowMobileSessions(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${(selectedSessionId === session._id || (!selectedSessionId && sessions[0]?._id === session._id))
                  ? 'bg-[#2A2B32] text-white border border-blue-500/40 shadow-sm font-semibold'
                  : 'text-[#a1a1aa] hover:bg-[#202020]'
                  }`}
              >
                <div className="truncate font-medium">{session.title}</div>
                {session.date && <div className="text-[10px] text-slate-500 mt-0.5">{session.date}</div>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#1E1E1E] min-w-0">
        {/* Safe Top Header Clearance for Mobile Notch / Slide-down Top Bar */}
        <div className="pt-12 pb-3 px-4 border-b border-white/10 bg-[#141414] flex items-center justify-between shrink-0 z-20">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Tasks</span>
          </button>

          <div className="flex items-center space-x-2">
            {/* Scratchpad Button - Top Right Corner with List Symbol ONLY (no words) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowScratchpad(!showScratchpad);
                  fetchScratchpad();
                }}
                title="Scratchpad View"
                className={`p-2 rounded-xl border transition-all relative flex items-center justify-center cursor-pointer ${
                  showScratchpad
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : scratchpadData?.active
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-[#2A2B32] text-slate-300 hover:text-white border-white/10 hover:bg-[#34353E]'
                }`}
              >
                <ClipboardList className={`w-4.5 h-4.5 ${scratchpadData?.active ? 'text-amber-400' : 'text-slate-300'}`} />
                {scratchpadData?.active && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                )}
              </button>

              {/* Scratchpad Inspector Popover */}
              {showScratchpad && (
                <div className="absolute right-0 top-12 w-96 bg-[#252528] border border-white/10 rounded-xl shadow-2xl z-50 p-4 font-sans text-sm text-[#e3e3e3] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="w-4.5 h-4.5 text-amber-400" />
                      <span className="font-semibold text-[#e3e3e3]">Scratchpad Inspector</span>
                      {scratchpadData?.active ? (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded-full">
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
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScratchpad ? 'animate-spin text-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowScratchpad(false)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {scratchpadData?.active ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {scratchpadData.pendingAction && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                            Pending Confirmation Action
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Operation:</span>
                            <span className="font-mono text-amber-200 font-medium">
                              {scratchpadData.pendingAction.operation}
                            </span>
                          </div>
                          {scratchpadData.pendingAction.tools && (
                            <div className="text-xs">
                              <span className="text-slate-400">Bound Tools: </span>
                              <span className="font-mono text-slate-200">
                                {scratchpadData.pendingAction.tools.join(', ')}
                              </span>
                            </div>
                          )}
                          {scratchpadData.pendingAction.reason && (
                            <div className="text-xs text-slate-300 italic pt-1 border-t border-amber-500/20">
                              "{scratchpadData.pendingAction.reason}"
                            </div>
                          )}
                        </div>
                      )}

                      {scratchpadData.dataContent && (
                        <div className="bg-slate-800/80 border border-white/10 rounded-lg p-3 space-y-1">
                          <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                            Stored Memory Summary
                          </div>
                          <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-all bg-black/30 p-2 rounded max-h-40 overflow-y-auto">
                            {scratchpadData.dataContent}
                          </pre>
                        </div>
                      )}

                      {/* Raw JSON Debug View */}
                      <details className="text-xs text-slate-400">
                        <summary className="cursor-pointer hover:text-slate-200 py-1 font-mono text-[11px]">
                          View raw JSON scratchpad payload
                        </summary>
                        <pre className="mt-1 font-mono text-[10px] text-emerald-400 bg-black/40 p-2 rounded border border-white/5 overflow-x-auto">
                          {JSON.stringify(scratchpadData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 space-y-2">
                      <ClipboardList className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                      <p className="text-xs font-medium text-slate-400">Scratchpad is currently empty</p>
                      <p className="text-[11px] text-slate-500 px-4">
                        When high-risk operations or memory summaries are staged on the transient scratchpad, they appear live here.
                      </p>
                    </div>
                  )}

                  {scratchpadData?.timestamp && (
                    <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Checked: {new Date(scratchpadData.timestamp).toLocaleTimeString()}</span>
                      <span className="text-amber-400/80 font-mono font-medium">Transient State</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Chat Sessions Toggle */}
            <button
              onClick={() => setShowMobileSessions(!showMobileSessions)}
              title="Toggle Sessions History"
              className="md:hidden p-2 rounded-lg bg-[#2A2B32] text-slate-300 hover:text-white border border-white/10 active:scale-95 transition-all"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-8"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {sessionMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 py-8">
                <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-500/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">How can I assist you today?</h3>
                  <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                    Connected to database tools for task scheduling, replanning, list management, and long-term memory retrieval.
                  </p>
                </div>

                {/* ChatGPT / Gemini Style Suggestion Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl pt-4">
                  <button
                    onClick={() => handleSubmit(undefined, "Replan my day schedule based on priority tasks.")}
                    className="p-3.5 rounded-2xl bg-[#2A2B32]/80 hover:bg-[#343541] border border-white/10 text-left transition-all group shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2 text-xs font-semibold text-purple-400 mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Smart Replanning</span>
                    </div>
                    <p className="text-xs text-slate-300 group-hover:text-white">Replan my day schedule based on priority tasks</p>
                  </button>

                  <button
                    onClick={() => handleSubmit(undefined, "Show my agenda and tasks due today.")}
                    className="p-3.5 rounded-2xl bg-[#2A2B32]/80 hover:bg-[#343541] border border-white/10 text-left transition-all group shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 mb-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Today's Agenda</span>
                    </div>
                    <p className="text-xs text-slate-300 group-hover:text-white">Show my agenda and tasks due today</p>
                  </button>

                  <button
                    onClick={() => handleSubmit(undefined, "Add a task: Study machine learning models tomorrow at 4 PM.")}
                    className="p-3.5 rounded-2xl bg-[#2A2B32]/80 hover:bg-[#343541] border border-white/10 text-left transition-all group shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Schedule Task</span>
                    </div>
                    <p className="text-xs text-slate-300 group-hover:text-white">Add task: Study machine learning models tomorrow at 4 PM</p>
                  </button>

                  <button
                    onClick={() => handleSubmit(undefined, "Retrieve my active long-term memories and goals.")}
                    className="p-3.5 rounded-2xl bg-[#2A2B32]/80 hover:bg-[#343541] border border-white/10 text-left transition-all group shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 mb-1">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Memory Context</span>
                    </div>
                    <p className="text-xs text-slate-300 group-hover:text-white">Retrieve my active long-term memories and goals</p>
                  </button>
                </div>
              </div>
            ) : (
              sessionMessages.map((msg, idx) => (
                <div key={msg._id || idx} className="flex items-start space-x-4 group">
                  {msg.role === 'assistant' || msg.role === 'system' ? (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex flex-shrink-0 items-center justify-center shadow">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex flex-shrink-0 items-center justify-center shadow">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-slate-200">
                          {msg.role === 'assistant' ? 'AI Assistant' : msg.role === 'system' ? 'System' : 'You'}
                        </span>
                        {msg.createdAt && (
                          <span className="text-xs text-slate-500 font-medium">
                            {formatTime(msg.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* Database Message Details Trigger */}
                      <button
                        onClick={() => setDetailModalMsg(msg)}
                        title="View Database Message Metrics & Token Details"
                        className="text-slate-500 hover:text-blue-400 opacity-80 hover:opacity-100 transition-opacity p-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="prose prose-invert prose-sm max-w-none text-[#D4D4D8] leading-relaxed break-words">
                      <FormattedMarkdown content={msg.content} />
                    </div>

                    {/* Display tool execution tags directly under message if present */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tc, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>{tc.tool}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-[#1E1E1E]">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                className="w-full bg-[#2A2B32] text-white border border-white/10 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-500 shadow-inner"
                placeholder="Message AI Assistant..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="absolute right-2 p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:bg-transparent disabled:text-slate-500 hover:bg-blue-500 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center mt-2 text-[11px] text-slate-500">
              AI can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>
      </div>

      {/* Database Message Details Modal */}
      {detailModalMsg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-white/10 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2 text-blue-400">
                <Database className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white">Database Message Details</h3>
              </div>
              <button
                onClick={() => setDetailModalMsg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-[#1b1b1b] rounded-xl border border-white/5">
                <span className="text-slate-400 font-medium">Message ID</span>
                <span className="text-slate-200 font-mono text-[11px] select-all">{detailModalMsg._id}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#1b1b1b] rounded-xl border border-white/5">
                <span className="text-slate-400 font-medium flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Model Engine</span>
                </span>
                <span className="text-indigo-300 font-semibold">{detailModalMsg.metadata?.model || 'OpenRouter LLM'}</span>
              </div>

              {/* Token Usage Section */}
              <div className="p-3 bg-[#1b1b1b] rounded-xl border border-white/5 space-y-2">
                <div className="text-xs font-bold text-blue-400 flex items-center justify-between">
                  <span>TOKEN USAGE</span>
                  <span className="text-slate-200 font-mono font-bold">
                    {detailModalMsg.metadata?.tokenUsage?.totalTokens ?? 'N/A'} total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Prompt Tokens:</span>
                    <span className="text-slate-200 font-mono">
                      {detailModalMsg.metadata?.tokenUsage?.promptTokens ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Completion Tokens:</span>
                    <span className="text-slate-200 font-mono">
                      {detailModalMsg.metadata?.tokenUsage?.completionTokens ?? 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executed Tools Section */}
              {detailModalMsg.toolCalls && detailModalMsg.toolCalls.length > 0 && (
                <div className="p-3 bg-[#1b1b1b] rounded-xl border border-white/5 space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>EXECUTED TOOL CALLS ({detailModalMsg.toolCalls.length})</span>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-white/5 max-h-36 overflow-y-auto">
                    {detailModalMsg.toolCalls.map((tc, idx) => (
                      <div key={idx} className="p-2 bg-[#242424] rounded-lg text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-300">{tc.tool}</span>
                          <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-mono">
                            {tc.status}
                          </span>
                        </div>
                        {tc.args && (
                          <div className="text-[10px] text-slate-400 font-mono bg-black/30 p-1.5 rounded truncate">
                            args: {JSON.stringify(tc.args)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
                <span>Created: {new Date(detailModalMsg.createdAt).toLocaleString()}</span>
                <span>Role: {detailModalMsg.role}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
