import React, { useState, useEffect } from 'react';
import { User, AIProviderConfig } from '@ai-task-manager/shared-types';
import { Settings, Key, Database, Globe, Sliders, Shield, Save, CheckCircle, RefreshCw, Trash2, ArrowUp, ArrowDown, Cpu, Server } from 'lucide-react';
import { api } from '../api/client';
import { offlineCache } from '../api/offlineCache';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (updated: User) => void;
  aiConfig: AIProviderConfig;
  onUpdateAIConfig: (config: AIProviderConfig) => void;
}

interface ModelItem {
  id: string;
  name: string;
  contextLength?: number;
}

const PRESET_OPENROUTER_MODELS: ModelItem[] = [];
const PRESET_GEMINI_MODELS: ModelItem[] = [];
const PRESET_GROK_MODELS: ModelItem[] = [];

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdateUser,
  aiConfig,
  onUpdateAIConfig,
}) => {
  const [serverUrl, setServerUrl] = useState(offlineCache.getServerUrl());
  const [systemPrompt, setSystemPrompt] = useState(user.aiInstructions.systemPrompt);
  const [dailySchedule, setDailySchedule] = useState(
    aiConfig.dailySchedule
  );
  const [mongoUri, setMongoUri] = useState(
    aiConfig.mongoUri || ''
  );

  // Provider keys
  const [openRouterKey, setOpenRouterKey] = useState(aiConfig.openrouter.apiKey || '');
  const [geminiKey, setGeminiKey] = useState(aiConfig.gemini.apiKey || '');
  const [grokKey, setGrokKey] = useState(aiConfig.grok.apiKey || '');

  // Primary models
  const [openRouterDefault, setOpenRouterDefault] = useState(aiConfig.openrouter.defaultModel || '');
  const [geminiDefault, setGeminiDefault] = useState(aiConfig.gemini.defaultModel || '');
  const [grokDefault, setGrokDefault] = useState(aiConfig.grok.defaultModel || '');

  // Ranked fallback models lists
  const [openRouterFallbacks, setOpenRouterFallbacks] = useState<string[]>(aiConfig.openrouter.fallbackModels || []);
  const [geminiFallbacks, setGeminiFallbacks] = useState<string[]>(aiConfig.gemini.fallbackModels || []);
  const [grokFallbacks, setGrokFallbacks] = useState<string[]>(aiConfig.grok.fallbackModels || []);

  // Combined models list (presets + API fetched models)
  const [availableModels, setAvailableModels] = useState<{
    openrouter: ModelItem[];
    gemini: ModelItem[];
    grok: ModelItem[];
  }>({
    openrouter: PRESET_OPENROUTER_MODELS,
    gemini: PRESET_GEMINI_MODELS,
    grok: PRESET_GROK_MODELS,
  });

  const [loadingModels, setLoadingModels] = useState<{
    openrouter: boolean;
    gemini: boolean;
    grok: boolean;
  }>({
    openrouter: false,
    gemini: false,
    grok: false,
  });

  const [savedNotice, setSavedNotice] = useState(false);

  const fetchModelsForProvider = async (provider: 'openrouter' | 'gemini' | 'grok', keyToUse?: string) => {
    setLoadingModels((prev) => ({ ...prev, [provider]: true }));
    try {
      const apiKey = keyToUse !== undefined ? keyToUse : provider === 'openrouter' ? openRouterKey : provider === 'gemini' ? geminiKey : grokKey;
      const data = await api.getAvailableModels(provider, apiKey);
      if (data && Array.isArray(data) && data.length > 0) {
        setAvailableModels((prev) => {
          const presets = provider === 'openrouter' ? PRESET_OPENROUTER_MODELS : provider === 'gemini' ? PRESET_GEMINI_MODELS : PRESET_GROK_MODELS;
          const mergedMap = new Map<string, ModelItem>();
          data.forEach((m) => mergedMap.set(m.id, m));
          presets.forEach((m) => {
            if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
          });
          return { ...prev, [provider]: Array.from(mergedMap.values()) };
        });

        // Auto-assign default model if currently empty
        if (provider === 'openrouter') {
          setOpenRouterDefault((prev) => prev || data[0].id);
        } else if (provider === 'gemini') {
          setGeminiDefault((prev) => prev || data[0].id);
        } else if (provider === 'grok') {
          setGrokDefault((prev) => prev || data[0].id);
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch models for ${provider}:`, err);
    } finally {
      setLoadingModels((prev) => ({ ...prev, [provider]: false }));
    }
  };

  useEffect(() => {
    // Auto-fetch models on component load (openrouter works with or without key)
    fetchModelsForProvider('openrouter', openRouterKey);
    if (geminiKey) fetchModelsForProvider('gemini', geminiKey);
    if (grokKey) fetchModelsForProvider('grok', grokKey);
  }, []);

  // Fetch when openRouterKey is updated
  useEffect(() => {
    if (openRouterKey) {
      fetchModelsForProvider('openrouter', openRouterKey);
    }
  }, [openRouterKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverUrl.trim()) {
      offlineCache.setServerUrl(serverUrl.trim());
    }

    onUpdateUser({
      ...user,
      aiInstructions: {
        systemPrompt,
      },
    });

    onUpdateAIConfig({
      ...aiConfig,
      systemPrompt,
      openrouter: {
        ...aiConfig.openrouter,
        apiKey: openRouterKey,
        defaultModel: openRouterDefault,
        fallbackModels: openRouterFallbacks,
      },
      gemini: {
        ...aiConfig.gemini,
        apiKey: geminiKey,
        defaultModel: geminiDefault,
        fallbackModels: geminiFallbacks,
      },
      grok: {
        ...aiConfig.grok,
        apiKey: grokKey,
        defaultModel: grokDefault,
        fallbackModels: grokFallbacks,
      },
      dailySchedule,
      mongoUri,
    });

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Helper functions for fallback candidates
  const addFallbackModel = (provider: 'openrouter' | 'gemini' | 'grok', modelId: string) => {
    if (!modelId) return;
    if (provider === 'openrouter') {
      if (!openRouterFallbacks.includes(modelId) && modelId !== openRouterDefault) {
        setOpenRouterFallbacks([...openRouterFallbacks, modelId]);
      }
    } else if (provider === 'gemini') {
      if (!geminiFallbacks.includes(modelId) && modelId !== geminiDefault) {
        setGeminiFallbacks([...geminiFallbacks, modelId]);
      }
    } else if (provider === 'grok') {
      if (!grokFallbacks.includes(modelId) && modelId !== grokDefault) {
        setGrokFallbacks([...grokFallbacks, modelId]);
      }
    }
  };

  const removeFallbackModel = (provider: 'openrouter' | 'gemini' | 'grok', index: number) => {
    if (provider === 'openrouter') {
      setOpenRouterFallbacks(openRouterFallbacks.filter((_, i) => i !== index));
    } else if (provider === 'gemini') {
      setGeminiFallbacks(geminiFallbacks.filter((_, i) => i !== index));
    } else if (provider === 'grok') {
      setGrokFallbacks(grokFallbacks.filter((_, i) => i !== index));
    }
  };

  const moveFallbackModel = (provider: 'openrouter' | 'gemini' | 'grok', index: number, direction: 'up' | 'down') => {
    const list = provider === 'openrouter' ? [...openRouterFallbacks] : provider === 'gemini' ? [...geminiFallbacks] : [...grokFallbacks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    if (provider === 'openrouter') setOpenRouterFallbacks(list);
    else if (provider === 'gemini') setGeminiFallbacks(list);
    else if (provider === 'grok') setGrokFallbacks(list);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-14 pb-12 space-y-8">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-slate-400" />
            <span>Settings & Configurations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personal instance configuration • BYOK AI Provider keys • Mobile & Remote Backend URL
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <CheckCircle className="w-4 h-4" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section: Backend Server URL Connection (Crucial for Mobile & Remote Sync) */}
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Backend Server API Connection URL</span>
            </h3>
            <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
              Persisted On-Device
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure the backend endpoint for mobile and desktop sync. On mobile devices, connect via your computer's local Wi-Fi IP (e.g. <code className="text-indigo-300">http://192.168.1.100:3001/api</code>) or emulator (<code className="text-indigo-300">http://10.0.2.2:3001/api</code>).
          </p>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://192.168.1.100:3001/api"
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50 font-mono"
          />
        </div>
        {/* Section: Normal Daily Schedule */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Normal Daily Schedule</span>
          </h3>
          <p className="text-xs text-slate-400">
            Write out your fixed daily schedule here. The AI Assistant will refer to this context box whenever you ask it to plan your day.
          </p>
          <textarea
            value={dailySchedule}
            onChange={(e) => setDailySchedule(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 leading-relaxed font-sans"
            placeholder="e.g., College lectures: 9:00 AM - 4:00 PM. Gym: 5:00 PM - 6:00 PM. Evening study: DBMS & DSA..."
          />
        </div>

        {/* Section: AI Instructions / System Prompt */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Personal AI Instructions (System Prompt)</span>
          </h3>
          <p className="text-xs text-slate-400">
            High-priority context provided directly by you. Passed to the AI model on every chat message.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 leading-relaxed font-sans"
            placeholder="e.g., Assist me in managing my academic and development tasks efficiently..."
          />
        </div>

        {/* Section: BYOK AI Providers & Dynamic Model Dropdown */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>AI Providers & Dynamic Fallback Model Ranking</span>
            </h3>
            <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>BYOK • Stored strictly on-device</span>
            </span>
          </div>

          {/* Provider 1: OpenRouter */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">OpenRouter Provider</span>
              </div>
              <button
                type="button"
                onClick={() => fetchModelsForProvider('openrouter')}
                disabled={loadingModels.openrouter}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels.openrouter ? 'animate-spin' : ''}`} />
                <span>{loadingModels.openrouter ? 'Fetching models...' : 'Fetch Models via API'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">OpenRouter API Key</label>
                <input
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50 font-mono"
                />
              </div>

              {/* Primary Model Select Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Primary Model (Default)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{availableModels.openrouter.length} models available</span>
                </label>
                <select
                  value={openRouterDefault}
                  onChange={(e) => setOpenRouterDefault(e.target.value)}
                  className="w-full bg-[#242424] border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500/50 font-mono cursor-pointer"
                >
                  {openRouterDefault && !availableModels.openrouter.some((m) => m.id === openRouterDefault) && (
                    <option value={openRouterDefault}>{openRouterDefault} (Custom)</option>
                  )}
                  {availableModels.openrouter.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* OpenRouter Ranked Fallback Candidates */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Ranked Fallback Candidate Models
              </label>
              <div className="flex items-center justify-between">

                <select
                  className="bg-[#242424] border border-blue-500/40 hover:border-blue-400 rounded-lg px-2.5 py-1 text-xs text-blue-300 font-mono focus:outline-none cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFallbackModel('openrouter', e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add candidate fallback model...</option>
                  {availableModels.openrouter
                    .filter((m) => m.id !== openRouterDefault && !openRouterFallbacks.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                </select>
              </div>

              {openRouterFallbacks.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic pl-1">
                  No candidate fallback models added yet. Select a model from "+ Add candidate fallback model" above to set your ranked backup list.
                </p>
              ) : (
                <div className="space-y-1.5 pl-1 pt-1">
                  {openRouterFallbacks.map((modelId, idx) => {
                    const modelObj = availableModels.openrouter.find((m) => m.id === modelId);
                    const displayName = modelObj ? `${modelObj.name} (${modelId})` : modelId;
                    return (
                      <div
                        key={modelId}
                        className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs"
                      >
                        <div className="flex items-center space-x-2.5 font-mono min-w-0 flex-1 pr-2">
                          <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                            #{idx + 1} Fallback
                          </span>
                          <span className="text-slate-200 truncate">{displayName}</span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('openrouter', idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            title="Move Up in Rank"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('openrouter', idx, 'down')}
                            disabled={idx === openRouterFallbacks.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            title="Move Down in Rank"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFallbackModel('openrouter', idx)}
                            className="p-1 text-rose-400 hover:text-rose-300"
                            title="Remove model"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Provider 2: Gemini */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Google Gemini Provider</span>
              </div>
              <button
                type="button"
                onClick={() => fetchModelsForProvider('gemini')}
                disabled={loadingModels.gemini}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels.gemini ? 'animate-spin' : ''}`} />
                <span>{loadingModels.gemini ? 'Fetching models...' : 'Fetch Models via Key'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Gemini API Key</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Primary Model (Default)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{availableModels.gemini.length} models available</span>
                </label>
                <select
                  value={geminiDefault}
                  onChange={(e) => setGeminiDefault(e.target.value)}
                  className="w-full bg-[#242424] border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono cursor-pointer"
                >
                  {geminiDefault && !availableModels.gemini.some((m) => m.id === geminiDefault) && (
                    <option value={geminiDefault}>{geminiDefault} (Custom)</option>
                  )}
                  {availableModels.gemini.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gemini Ranked Fallback Candidates */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Ranked Fallback Candidate Models
              </label>
              <div className="flex items-center justify-between">

                <select
                  className="bg-[#242424] border border-emerald-500/40 hover:border-emerald-400 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono focus:outline-none cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFallbackModel('gemini', e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add candidate fallback model...</option>
                  {availableModels.gemini
                    .filter((m) => m.id !== geminiDefault && !geminiFallbacks.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                </select>
              </div>

              {geminiFallbacks.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic pl-1">
                  No candidate fallback models added yet. Select a model from "+ Add candidate fallback model" above.
                </p>
              ) : (
                <div className="space-y-1.5 pl-1 pt-1">
                  {geminiFallbacks.map((modelId, idx) => {
                    const modelObj = availableModels.gemini.find((m) => m.id === modelId);
                    const displayName = modelObj ? `${modelObj.name} (${modelId})` : modelId;
                    return (
                      <div
                        key={modelId}
                        className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs"
                      >
                        <div className="flex items-center space-x-2.5 font-mono min-w-0 flex-1 pr-2">
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            #{idx + 1} Fallback
                          </span>
                          <span className="text-slate-200 truncate">{displayName}</span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('gemini', idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('gemini', idx, 'down')}
                            disabled={idx === geminiFallbacks.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFallbackModel('gemini', idx)}
                            className="p-1 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* grok  */}
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Grok Provider</span>
              </div>
              <button
                type="button"
                onClick={() => fetchModelsForProvider('grok')}
                disabled={loadingModels.grok}
                className="flex items-center space-x-1 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels.grok ? 'animate-spin' : ''}`} />
                <span>{loadingModels.grok ? 'Fetching models...' : 'Fetch Models via Key'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Grok API Key</label>
                <input
                  type="password"
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                  <span>Primary Model (Default)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{availableModels.grok.length} models available</span>
                </label>
                <select
                  value={grokDefault}
                  onChange={(e) => setGrokDefault(e.target.value)}
                  className="w-full bg-[#242424] border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono cursor-pointer"
                >
                  {grokDefault && !availableModels.grok.some((m) => m.id === grokDefault) && (
                    <option value={grokDefault}>{grokDefault} (Custom)</option>
                  )}
                  {availableModels.grok.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gemini Ranked Fallback Candidates */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Ranked Fallback Candidate Models
              </label>
              <div className="flex items-center justify-between">

                <select
                  className="bg-[#242424] border border-emerald-500/40 hover:border-emerald-400 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono focus:outline-none cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFallbackModel('grok', e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add candidate fallback model...</option>
                  {availableModels.grok
                    .filter((m) => m.id !== grokDefault && !grokFallbacks.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                </select>
              </div>

              {grokFallbacks.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic pl-1">
                  No candidate fallback models added yet. Select a model from "+ Add candidate fallback model" above.
                </p>
              ) : (
                <div className="space-y-1.5 pl-1 pt-1">
                  {grokFallbacks.map((modelId, idx) => {
                    const modelObj = availableModels.grok.find((m) => m.id === modelId);
                    const displayName = modelObj ? `${modelObj.name} (${modelId})` : modelId;
                    return (
                      <div
                        key={modelId}
                        className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs"
                      >
                        <div className="flex items-center space-x-2.5 font-mono min-w-0 flex-1 pr-2">
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            #{idx + 1} Fallback
                          </span>
                          <span className="text-slate-200 truncate">{displayName}</span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('grok', idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFallbackModel('grok', idx, 'down')}
                            disabled={idx === grokFallbacks.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFallbackModel('grok', idx)}
                            className="p-1 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>





        {/* Section: Google Services OAuth Connection */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Google Tasks & Google Calendar Sync</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Google Tasks API</p>
                <p className="text-[11px] text-slate-400">Two-way task synchronization</p>
              </div>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 font-medium">
                Connected
              </span>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Google Calendar API</p>
                <p className="text-[11px] text-slate-400">Timeblock schedule sync</p>
              </div>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 font-medium">
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Section: MongoDB Atlas Database */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span>MongoDB Atlas Connection</span>
          </h3>
          <p className="text-xs text-slate-400">
            Source of truth database for cross-device synchronization (Desktop & Mobile).
          </p>
          <input
            type="password"
            value={mongoUri}
            onChange={(e) => setMongoUri(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50 font-mono"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Configurations</span>
          </button>
        </div>
      </form>
    </div>
  );
};
