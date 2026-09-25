import React, { useState, useEffect } from 'react';
import { Memory, AIAgentGoal } from '@ai-task-manager/shared-types';
import { Brain, Target, Clock, CheckCircle2, AlertCircle, Trash2, Plus, Sparkles, Filter, RefreshCw, Calendar, Tag, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export const MemoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent-goals' | 'memories'>('agent-goals');
  const [agentGoals, setAgentGoals] = useState<AIAgentGoal[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'long_term' | 'medium_term' | 'short_term'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add memory modal state
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTier, setNewTier] = useState<'long_term' | 'medium_term' | 'short_term'>('medium_term');
  const [newCategory, setNewCategory] = useState('preferences');

  const loadData = async () => {
    setLoading(true);
    const [fetchedGoals, fetchedMemories] = await Promise.all([
      api.getAIAgentGoals(),
      api.getMemories(),
    ]);
    if (fetchedGoals) setAgentGoals(fetchedGoals);
    if (fetchedMemories) setMemories(fetchedMemories);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleDeleteMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m._id !== id));
    await api.deleteMemory(id);
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const created = await api.createMemory({
      content: newContent.trim(),
      memoryTier: newTier,
      category: newCategory,
      importance: 0.8,
      source: 'explicit_user',
    });

    if (created) {
      setMemories((prev) => [created, ...prev]);
    }
    setNewContent('');
    setShowAddMemory(false);
  };

  const pendingGoals = agentGoals.filter((g) => g.status === 'pending');
  const executedGoals = agentGoals.filter((g) => g.status === 'executed');

  const filteredMemories = memories.filter((m) => {
    const matchesTier = memoryFilter === 'all' || m.memoryTier === memoryFilter;
    const matchesQuery = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase()) || (m.tags && m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesTier && matchesQuery;
  });

  return (
    <div className="h-full w-full overflow-y-auto p-8 space-y-8 bg-[#1f1f1f] text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-3 text-white tracking-tight">
            <Brain className="w-7 h-7 text-indigo-400" />
            <span>Memory Bank & Autonomous AI Goals</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            View scheduled background goals, self-executed AI actions, and mid-term / long-term memory context.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {activeTab === 'memories' && (
            <button
              onClick={() => setShowAddMemory(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Memory</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-[#252525] border border-white/10 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white font-mono">{pendingGoals.length}</p>
            <p className="text-xs text-slate-400 font-medium">Pending Autonomous Goals</p>
          </div>
        </div>

        <div className="p-5 bg-[#252525] border border-white/10 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white font-mono">{executedGoals.length}</p>
            <p className="text-xs text-slate-400 font-medium">Self-Executed AI Actions</p>
          </div>
        </div>

        <div className="p-5 bg-[#252525] border border-white/10 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white font-mono">{memories.length}</p>
            <p className="text-xs text-slate-400 font-medium">Active Memory Entries</p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-white/10 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('agent-goals')}
          className={`pb-3 flex items-center space-x-2 transition-all border-b-2 ${
            activeTab === 'agent-goals'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Autonomous AI Agent Goals ({agentGoals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('memories')}
          className={`pb-3 flex items-center space-x-2 transition-all border-b-2 ${
            activeTab === 'memories'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>Memory Bank Context ({memories.length})</span>
        </button>
      </div>

      {/* Tab 1: AI Agent Goals */}
      {activeTab === 'agent-goals' && (
        <div className="space-y-8">
          {/* Scheduled Pending Goals */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Scheduled Pending Goals ({pendingGoals.length})</span>
            </h3>

            {pendingGoals.length === 0 ? (
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center text-xs text-slate-500 italic">
                No background goals currently scheduled. When you ask the AI to do something tomorrow (e.g. "delete list tomorrow"), it registers a background goal here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingGoals.map((goal) => (
                  <div
                    key={goal._id}
                    className="p-5 bg-[#252525] border border-amber-500/20 rounded-2xl space-y-3 shadow-lg relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                          {goal.actionType}
                        </span>
                        <h4 className="text-sm font-semibold text-white mt-2">{goal.title}</h4>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                        Pending
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Target Time: {new Date(goal.targetExecutionTime).toLocaleString()}</span>
                    </div>

                    {goal.payload && Object.keys(goal.payload).length > 0 && (
                      <div className="p-2.5 bg-black/30 rounded-xl text-[11px] text-slate-400 font-mono">
                        Payload: {JSON.stringify(goal.payload)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Executed Goals History */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Self-Executed Actions History ({executedGoals.length})</span>
            </h3>

            {executedGoals.length === 0 ? (
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center text-xs text-slate-500 italic">
                No past executed agent goal logs found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {executedGoals.map((goal) => (
                  <div
                    key={goal._id}
                    className="p-4 bg-[#252525] border border-white/10 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                          Executed
                        </span>
                        <span className="font-semibold text-slate-200">{goal.title}</span>
                      </div>
                      <p className="text-slate-400 font-mono text-[11px]">{goal.lastLogMessage || 'Action completed successfully.'}</p>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono shrink-0">
                      Executed at: {goal.executedAt ? new Date(goal.executedAt).toLocaleString() : 'Recently'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Memory Bank Context */}
      {activeTab === 'memories' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2">
              {(['all', 'medium_term', 'long_term', 'short_term'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setMemoryFilter(tier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                    memoryFilter === tier
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {tier.replace('_', ' ')}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-full md:w-64"
            />
          </div>

          {/* Memories Grid */}
          {filteredMemories.length === 0 ? (
            <div className="p-10 bg-white/[0.02] border border-white/5 rounded-2xl text-center text-xs text-slate-500 italic">
              No memory entries found matching your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMemories.map((mem) => (
                <div
                  key={mem._id}
                  className="p-5 bg-[#252525] border border-white/10 rounded-2xl space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase border ${
                        mem.memoryTier === 'long_term'
                          ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                          : mem.memoryTier === 'medium_term'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      {mem.memoryTier || 'memory'} • {mem.category}
                    </span>

                    <button
                      onClick={() => handleDeleteMemory(mem._id)}
                      className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete memory entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans">{mem.content}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5">
                    <span>Source: {mem.source}</span>
                    {mem.validUntil && <span>Valid until: {mem.validUntil}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddMemory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Brain className="w-5 h-5 text-indigo-400" />
              <span>Record New Memory Entry</span>
            </h3>

            <form onSubmit={handleCreateMemory} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Memory Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  placeholder="e.g. Prefer studying complex subjects in 90-minute blocks..."
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Memory Tier</label>
                  <select
                    value={newTier}
                    onChange={(e: any) => setNewTier(e.target.value)}
                    className="w-full bg-[#1b1b1b] border border-white/10 p-2 rounded-xl text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="medium_term">Medium Term</option>
                    <option value="long_term">Long Term</option>
                    <option value="short_term">Short Term</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-2 rounded-xl text-xs text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemory(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-lg"
                >
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
