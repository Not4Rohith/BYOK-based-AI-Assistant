import React, { useState, useEffect } from 'react';
import { Task, TaskList, User } from '@ai-task-manager/shared-types';
import { GoogleTaskDetailsMobileScreen } from './GoogleTaskDetailsMobileScreen';
import { GoogleDatePopover } from './GoogleDatePopover';
import { api } from '../api/client';
import {
  Plus,
  Star,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  Clock,
  Sparkles,
  Settings,
  Brain,
  MessageSquare,
  User as UserIcon,
  RefreshCw,
  X,
  Check,
  Loader2,
} from 'lucide-react';

interface GoogleTasksMobileViewProps {
  taskLists: TaskList[];
  tasks: Task[];
  user: User;
  onToggleTask: (id: string) => void;
  onAddTask: (listId: string, title: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onCreateList: (title: string) => void;
  onDeleteList: (listId: string) => void;
  onRenameList: (listId: string, newTitle: string) => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onOpenAIChat: () => void;
  onAskAI: (prompt: string) => void;
  onRefresh?: () => Promise<void> | void;
  isConnected?: boolean;
  isCheckingHealth?: boolean;
  onCheckHealth?: () => void;
}

export const GoogleTasksMobileView: React.FC<GoogleTasksMobileViewProps> = ({
  taskLists,
  tasks,
  user,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleStar,
  onCreateList,
  onDeleteList,
  onRenameList,
  onOpenSettings,
  onOpenMemory,
  onOpenAIChat,
  onAskAI,
  onRefresh,
  isConnected = true,
  isCheckingHealth = false,
  onCheckHealth,
}) => {
  const [activeListId, setActiveListId] = useState<string>('starred');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDetails, setQuickDetails] = useState('');
  const [quickStarred, setQuickStarred] = useState(false);
  const [showQuickDetailsInput, setShowQuickDetailsInput] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Daily AI Summary state for bottom taskbar
  const [aiSummary, setAiSummary] = useState<string>('Ask AI anything or manage tasks...');
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        const data = await api.getDailySummary();
        if (data && data.summary) {
          setAiSummary(data.summary);
        }
        setLoadingSummary(false);
      } catch {
        setLoadingSummary(false);
      }
    };
    fetchSummary();
  }, []);

  // Pull to refresh & horizontal swipe states
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const allTabIds = ['starred', ...taskLists.map((l) => l._id)];

  useEffect(() => {
    // Auto scroll active tab header button into view smoothly
    const activeTabEl = document.getElementById(`tab-btn-${activeListId}`);
    if (activeTabEl) {
      activeTabEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeListId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    const scrollContainer = e.currentTarget;
    if (scrollContainer.scrollTop === 0) {
      setPullStartY(touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY !== null) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - pullStartY;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.5, 90));
      }
    }
  };

  const triggerRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onCheckHealth) await onCheckHealth();
      if (onRefresh) await onRefresh();
    } catch {} finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        setPullStartY(null);
      }, 500);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX !== null && touchStartY !== null && e.changedTouches.length > 0) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Smooth swipe category tab transition (horizontal swipe > 40px)
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        const currentIndex = allTabIds.indexOf(activeListId);
        if (deltaX < 0) {
          // Swipe Left -> Next Category Tab
          if (currentIndex !== -1 && currentIndex < allTabIds.length - 1) {
            setActiveListId(allTabIds[currentIndex + 1]);
          }
        } else {
          // Swipe Right -> Previous Category Tab
          if (currentIndex > 0) {
            setActiveListId(allTabIds[currentIndex - 1]);
          }
        }
      }
    }

    if (pullDistance > 45) {
      triggerRefresh();
    } else {
      setPullDistance(0);
      setPullStartY(null);
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const isStarTab = activeListId === 'starred';
  const currentList = taskLists.find((l) => l._id === activeListId) || taskLists[0];
  const currentListId = isStarTab ? '' : (currentList?._id || '');

  const activeTasks = isStarTab
    ? tasks.filter((t) => t.starred && t.status !== 'completed')
    : tasks.filter((t) => t.listId === currentListId && t.status !== 'completed');

  const completedTasks = isStarTab
    ? tasks.filter((t) => t.starred && t.status === 'completed')
    : tasks.filter((t) => t.listId === currentListId && t.status === 'completed');

  const handleSaveQuickTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim()) return;

    const listTarget = currentListId || taskLists[0]?._id || 'list_basic_info';
    onAddTask(listTarget, quickTitle.trim());

    if (quickDetails.trim() || quickStarred) {
      setTimeout(() => {
        const created = tasks.find((t) => t.title === quickTitle.trim());
        if (created) {
          onUpdateTask(created._id, {
            description: quickDetails.trim() || undefined,
            starred: quickStarred || isStarTab,
          });
        }
      }, 300);
    }

    setQuickTitle('');
    setQuickDetails('');
    setQuickStarred(false);
    setShowQuickDetailsInput(false);
    setShowQuickAdd(false);
  };

  const handleCreateNewListSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newListTitle.trim()) return;
    onCreateList(newListTitle.trim());
    setNewListTitle('');
    setShowCreateListModal(false);
  };

  if (selectedTask) {
    const liveTask = tasks.find((t) => t._id === selectedTask._id) || selectedTask;
    return (
      <GoogleTaskDetailsMobileScreen
        task={liveTask}
        taskLists={taskLists}
        onBack={() => setSelectedTask(null)}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onToggleStar={onToggleStar}
        onToggleTask={onToggleTask}
        onCreateList={onCreateList}
        onAskAI={onAskAI}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#141218] text-[#E6E1E5] font-sans relative overflow-hidden select-none">
      {/* 1. Top App Bar (Google Tasks Mobile Header - Android safe area top clearance: 48px ~ 56px) */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 bg-[#141218] shrink-0">
        <h1 className="text-2xl font-normal text-[#E6E1E5] tracking-tight">Tasks</h1>

        <div className="flex items-center space-x-2">
          {/* Render Connection Status Badge */}
          <button
            onClick={onCheckHealth}
            title={
              isConnected
                ? 'Render Backend: Connected (Click to re-check)'
                : 'Render Backend: Offline (Click to retry connection)'
            }
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 border transition-all ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isCheckingHealth
                  ? 'bg-amber-400 animate-ping'
                  : isConnected
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
              }`}
            />
            <span className="text-[11px] font-semibold">{isConnected ? 'Render' : 'Offline'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={triggerRefresh}
            title="Refresh backend tasks"
            className="p-2 text-[#CAC4D0] hover:text-[#D0BCFF] rounded-full hover:bg-[#2B2930] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D0BCFF]' : ''}`} />
          </button>
        <div className="relative">
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-9 h-9 rounded-full bg-[#D0BCFF] text-[#381E72] font-semibold text-sm flex items-center justify-center shadow-md active:scale-95 transition-all"
          >
            {user.profile.name.charAt(0).toUpperCase()}
          </button>

          {/* Account Dropdown Menu */}
          {showAccountMenu && (
            <div className="absolute right-0 top-11 w-56 bg-[#2B2930] rounded-2xl border border-[#36343B] shadow-2xl z-50 p-2 space-y-1">
              <div className="px-3 py-2 border-b border-[#36343B]">
                <p className="text-xs font-semibold text-[#E6E1E5]">{user.profile.name}</p>
                <p className="text-[10px] text-[#CAC4D0]">Personal AI Account</p>
              </div>

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenAIChat();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-[#E6E1E5] hover:bg-[#36343B] transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-[#D0BCFF]" />
                <span>Full AI Chat Assistant</span>
              </button>

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenMemory();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-[#E6E1E5] hover:bg-[#36343B] transition-colors"
              >
                <Brain className="w-4 h-4 text-[#D0BCFF]" />
                <span>Memory & AI Goals</span>
              </button>

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs text-[#E6E1E5] hover:bg-[#36343B] transition-colors"
              >
                <Settings className="w-4 h-4 text-[#D0BCFF]" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* 2. List Area Horizontal Tab Bar (Invisible Scrollbar no-scrollbar) */}
      <div className="flex items-center space-x-2 px-4 border-b border-[#2B2930] overflow-x-auto no-scrollbar shrink-0 scroll-smooth">
        {/* Tab #0: Star Tab ★ */}
        <button
          id="tab-btn-starred"
          onClick={() => setActiveListId('starred')}
          className={`py-2.5 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex items-center space-x-1 ${
            isStarTab
              ? 'border-[#D0BCFF] text-[#D0BCFF]'
              : 'border-transparent text-[#CAC4D0] hover:text-[#E6E1E5]'
          }`}
        >
          <Star className={`w-4 h-4 ${isStarTab ? 'fill-[#D0BCFF]' : ''}`} />
        </button>

        {taskLists.map((list) => {
          const isActive = list._id === activeListId;
          const listTaskCount = tasks.filter((t) => t.listId === list._id && t.status !== 'completed').length;
          return (
            <button
              key={list._id}
              id={`tab-btn-${list._id}`}
              onClick={() => setActiveListId(list._id)}
              className={`py-2.5 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? 'border-[#D0BCFF] text-[#D0BCFF]'
                  : 'border-transparent text-[#CAC4D0] hover:text-[#E6E1E5]'
              }`}
            >
              {list.title} {listTaskCount > 0 ? `(${listTaskCount})` : ''}
            </button>
          );
        })}

        {/* + New List tab button */}
        <button
          onClick={() => setShowCreateListModal(true)}
          className="py-2.5 px-3 text-sm font-medium text-[#D0BCFF] hover:text-[#E8DEF8] whitespace-nowrap flex items-center space-x-1"
        >
          <Plus className="w-4 h-4" />
          <span>New list</span>
        </button>
      </div>

      {/* 3. Main Task Content Surface with Touch Pull-to-Refresh */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative pb-24"
      >
        {/* Pull to refresh visual indicator banner */}
        {(pullDistance > 0 || isRefreshing) && (
          <div className="flex items-center justify-center py-2 text-xs font-medium text-[#D0BCFF] space-x-2 transition-all">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing tasks from server...' : pullDistance > 45 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        )}

        {/* Single Rounded Container Card matching 2024 Google Tasks Android Design */}
        <div className="bg-[#1E1B24] rounded-3xl p-4 border border-[#2B2930] shadow-xl min-h-[60vh] flex flex-col justify-between">
          <div className="space-y-1">
            {/* List Header Title */}
            <div className="px-2 py-1 mb-2 flex items-center justify-between">
              <h2 className="text-lg font-normal text-[#E6E1E5]">
                {currentList?.title || 'My Tasks'}
              </h2>
            </div>

            {/* Active Task Rows or Empty States */}
            {activeTasks.length === 0 ? (
              isStarTab ? (
                /* Star Tab Empty State (Screenshot 2: Screenshot_20260924_204452.jpg) */
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 px-4">
                  <div className="w-24 h-24 rounded-full bg-[#36343B]/50 flex items-center justify-center border border-[#49454F]/30 shadow-inner">
                    <Star className="w-12 h-12 text-[#E8DEF8] fill-[#E8DEF8]/20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-normal text-[#E6E1E5]">No starred tasks</h3>
                    <p className="text-xs text-[#CAC4D0] max-w-xs leading-relaxed">
                      Mark tasks with a star to easily find them here when you need to access them quickly.
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty List State (Screenshot 3 & 4: Screenshot_20260924_204453.jpg) */
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 px-4">
                  <div className="w-24 h-24 rounded-full bg-[#36343B]/50 flex items-center justify-center border border-[#49454F]/30 shadow-inner">
                    <CheckCircle2 className="w-12 h-12 text-[#D0BCFF]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-normal text-[#E6E1E5]">A fresh start</h3>
                    <p className="text-xs text-[#CAC4D0] max-w-xs leading-relaxed">
                      Anything to do? Tap <span className="text-[#D0BCFF] font-semibold">+</span> to add a task or ask AI to plan your day.
                    </p>
                  </div>
                </div>
              )
            ) : (
              activeTasks.map((t) => (
                <div
                  key={t._id}
                  className="flex items-start justify-between py-3 px-2 rounded-2xl hover:bg-[#2B2930] transition-colors group cursor-pointer"
                  onClick={() => setSelectedTask(t)}
                >
                  {/* Left Circle Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(t._id);
                    }}
                    className="mt-0.5 mr-3 text-[#CAC4D0] hover:text-[#D0BCFF] transition-colors"
                  >
                    <Circle className="w-5 h-5" />
                  </button>

                  {/* Task Content Title & Sub-notes */}
                  <div className="flex-1 pr-3 min-w-0">
                    <p className="text-sm font-normal text-[#E6E1E5] truncate">{t.title}</p>

                    {/* Secondary Information */}
                    {(t.description || t.scheduledStart || t.subtasks?.length) && (
                      <div className="flex items-center space-x-2 text-xs text-[#CAC4D0] mt-0.5 truncate">
                        {t.description && (
                          <span className="truncate max-w-[140px] text-[#938F99]">{t.description}</span>
                        )}
                        {t.scheduledStart && (
                          <span className="text-[#D0BCFF] text-[11px] bg-[#2B2930] px-2 py-0.5 rounded-md border border-[#36343B]">
                            {new Date(t.scheduledStart).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Star Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(t._id);
                    }}
                    className="p-1 text-[#CAC4D0] hover:text-[#D0BCFF] transition-colors"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        t.starred ? 'fill-[#D0BCFF] text-[#D0BCFF]' : 'text-[#79747E]'
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 4. Completed Tasks Section */}
          {completedTasks.length > 0 && (
            <div className="pt-4 border-t border-[#2B2930] mt-6">
              <button
                onClick={() => setCompletedExpanded(!completedExpanded)}
                className="flex items-center space-x-2 text-xs font-semibold text-[#CAC4D0] hover:text-[#E6E1E5] px-2 py-1 transition-colors"
              >
                {completedExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#D0BCFF]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#CAC4D0]" />
                )}
                <span>Completed ({completedTasks.length})</span>
              </button>

              {completedExpanded && (
                <div className="space-y-1 mt-2">
                  {completedTasks.map((t) => (
                    <div
                      key={t._id}
                      className="flex items-start justify-between py-2.5 px-2 rounded-2xl hover:bg-[#2B2930] transition-colors cursor-pointer opacity-70"
                      onClick={() => setSelectedTask(t)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t._id);
                        }}
                        className="mt-0.5 mr-3 text-[#D0BCFF]"
                      >
                        <CheckCircle2 className="w-5 h-5 fill-[#D0BCFF] text-[#1E1B24]" />
                      </button>
                      <div className="flex-1 pr-3 min-w-0">
                        <p className="text-sm font-normal text-[#938F99] line-through truncate">
                          {t.title}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(t._id);
                        }}
                        className="p-1 text-[#79747E]"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            t.starred ? 'fill-[#938F99] text-[#938F99]' : 'text-[#49454F]'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Mobile Bottom AI Taskbar Attached to Screen Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1E1B24]/95 backdrop-blur-xl border-t border-[#2B2930] px-3.5 py-2.5 flex items-center space-x-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        {/* Floating AI Shortcut Taskbar Input Pill */}
        <div
          onClick={onOpenAIChat}
          className="flex-1 flex items-center space-x-2.5 bg-[#2B2930] hover:bg-[#36343B] active:scale-[0.99] border border-[#3D3A45] rounded-full px-3.5 py-2 text-[#CAC4D0] cursor-pointer transition-all shadow-inner group"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-md shrink-0">
            {loadingSummary ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            )}
          </div>
          <span className="text-xs font-medium text-[#CAC4D0] group-hover:text-[#E6E1E5] truncate flex-1">
            {loadingSummary ? 'Analyzing daily summary...' : aiSummary}
          </span>
          <div className="px-2.5 py-1 rounded-full bg-[#381E72] text-[#D0BCFF] text-[10px] font-bold tracking-wide uppercase shrink-0 border border-[#4F378B]">
            Ask AI
          </div>
        </div>

        {/* Primary Material 3 Floating Action Button (FAB) */}
        <button
          onClick={() => setShowQuickAdd(true)}
          className="w-11 h-11 rounded-2xl bg-[#E8DEF8] text-[#1D1B20] flex items-center justify-center shadow-lg hover:bg-[#D0BCFF] active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* 6. Quick Add Task Sheet Drawer (Matching Screenshot 3) */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setShowQuickAdd(false)} />

          <form
            onSubmit={handleSaveQuickTask}
            className="relative w-full max-w-md bg-[#25232A] rounded-t-3xl border-t border-[#36343B] p-4 text-[#E6E1E5] space-y-3 shadow-2xl z-10 animate-slideUp"
          >
            {/* Input field */}
            <input
              type="text"
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="New task"
              className="w-full text-base font-normal bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E] px-2 py-1"
            />

            {/* Optional Details Input */}
            {showQuickDetailsInput && (
              <textarea
                value={quickDetails}
                onChange={(e) => setQuickDetails(e.target.value)}
                placeholder="Add details"
                rows={2}
                className="w-full text-sm bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E] px-2 resize-none"
              />
            )}

            {/* Icon Toolbar Row matching Screenshot 3 */}
            <div className="flex items-center justify-between pt-2 border-t border-[#36343B] px-1">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQuickDetailsInput(!showQuickDetailsInput)}
                  className={`p-2 rounded-full hover:bg-[#36343B] transition-colors ${
                    showQuickDetailsInput ? 'text-[#D0BCFF]' : 'text-[#CAC4D0]'
                  }`}
                >
                  <AlignLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const promptText = prompt('Ask AI to auto-schedule or create task details:');
                    if (promptText) onAskAI(promptText);
                  }}
                  className="p-2 text-[#CAC4D0] hover:text-[#D0BCFF] rounded-full hover:bg-[#36343B] transition-colors"
                >
                  <Clock className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setQuickStarred(!quickStarred)}
                  className={`p-2 rounded-full hover:bg-[#36343B] transition-colors ${
                    quickStarred ? 'text-[#D0BCFF]' : 'text-[#CAC4D0]'
                  }`}
                >
                  <Star className={`w-5 h-5 ${quickStarred ? 'fill-[#D0BCFF]' : ''}`} />
                </button>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="px-4 py-1.5 rounded-full text-sm font-semibold text-[#D0BCFF] disabled:text-[#79747E] hover:bg-[#36343B] transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Create New List Modal (Matching Screenshot 6: Screenshot_20260924_204511.jpg) */}
      {showCreateListModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#141218] text-[#E6E1E5] font-sans">
          {/* Header Bar with ✕ back button and Done button */}
          <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-[#2B2930]">
            <button
              onClick={() => setShowCreateListModal(false)}
              className="p-2 text-[#CAC4D0] hover:text-[#E6E1E5] rounded-full hover:bg-[#2B2930] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <button
              onClick={handleCreateNewListSubmit}
              disabled={!newListTitle.trim()}
              className="text-sm font-semibold text-[#D0BCFF] disabled:text-[#79747E] px-3 py-1 hover:bg-[#2B2930] rounded-full transition-colors"
            >
              Done
            </button>
          </div>

          {/* Body with Enter list title input */}
          <div className="flex-1 p-6">
            <input
              type="text"
              autoFocus
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              placeholder="Enter list title"
              className="w-full text-xl font-normal bg-transparent text-[#E6E1E5] focus:outline-none placeholder-[#79747E] py-2 border-b border-[#D0BCFF]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
