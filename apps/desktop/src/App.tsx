import React, { useState, useEffect } from 'react';
import { GoogleHeader } from './components/GoogleHeader';
import { GoogleSidebar, SidebarViewMode } from './components/GoogleSidebar';
import { GoogleBoardView } from './components/GoogleBoardView';
import { GoogleTasksMobileView } from './components/GoogleTasksMobileView';
import { SettingsView } from './components/SettingsView';
import { MemoryView } from './components/MemoryView';
import { AITaskbar } from './components/AITaskbar';
import { FullScreenChat } from './components/FullScreenChat';
import { api } from './api/client';
import { Task, TaskList, User, AIProviderConfig, ChatMessage, ChatSession } from '@ai-task-manager/shared-types';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<SidebarViewMode | 'ai-chat'>('all-tasks');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [user, setUser] = useState<User>({
    _id: 'usr_1',
    profile: { name: 'User', timezone: 'Asia/Kolkata' },
    aiInstructions: { systemPrompt: '' },
    planningPreferences: {
      preferredStartTime: '07:00',
      preferredEndTime: '22:00',
      defaultBufferMinutes: 15,
      preferRealisticSchedules: true,
      maxContinuousWorkMinutes: 90
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    openrouter: { enabled: true, defaultModel: '', fallbackModels: [], apiKey: '' },
    gemini: { enabled: true, defaultModel: '', fallbackModels: [], apiKey: '' },
    grok: { enabled: false, defaultModel: '', fallbackModels: [], apiKey: '' }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // State to track which categories are ticked/checked in the sidebar for board layout display
  const [tickedListIds, setTickedListIds] = useState<string[]>([]);

  // Sync initial state and periodically poll backend for autonomous AI background actions
  useEffect(() => {
    async function loadBackendData() {
      const serverLists = await api.getTaskLists();
      if (serverLists) {
        setTaskLists(serverLists);
        setTickedListIds(serverLists.map((l) => l._id));
      }

      const serverTasks = await api.getTasks();
      if (serverTasks) setTasks(serverTasks);

      const serverChat = await api.getChatMessages();
      if (serverChat) setMessages(serverChat);

      const serverConfig = await api.getAIConfig();
      if (serverConfig) setAiConfig(serverConfig);

      const serverSessions = await api.getChatSessions();
      if (serverSessions) setSessions(serverSessions);
    }

    loadBackendData();

    // Poll every 8s for autonomous runner background updates (e.g. deleted lists/tasks or check-in chats)
    const interval = setInterval(async () => {
      const [serverTasks, serverLists, serverChat, serverSessions] = await Promise.all([
        api.getTasks(),
        api.getTaskLists(),
        api.getChatMessages(),
        api.getChatSessions(),
      ]);
      if (serverTasks) setTasks(serverTasks);
      if (serverLists) {
        setTaskLists(serverLists);
        setTickedListIds((prev) => {
          const serverIds = new Set(serverLists.map((l) => l._id));
          const validPrev = prev.filter((id) => serverIds.has(id));
          // Automatically check/tick newly created category columns so they display on the board right away
          const newlyAdded = serverLists.map((l) => l._id).filter((id) => !prev.includes(id));
          return [...validPrev, ...newlyAdded];
        });
      }
      if (serverChat) setMessages(serverChat);
      if (serverSessions) setSessions(serverSessions);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleListTicked = (listId: string) => {
    setTickedListIds((prev) =>
      prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId]
    );
  };

  const handleDeleteList = async (listIdOrTitle: string) => {
    // Optimistically remove from frontend state
    setTaskLists((prev) =>
      prev.filter((l) => l._id !== listIdOrTitle && l.title.toLowerCase() !== listIdOrTitle.toLowerCase())
    );
    setTasks((prev) => prev.filter((t) => t.listId !== listIdOrTitle));
    setTickedListIds((prev) => prev.filter((id) => id !== listIdOrTitle));

    if (activeView === listIdOrTitle) {
      setActiveView('all-tasks');
    }

    // Persist deletion in backend database (MongoDB Atlas)
    await api.deleteTaskList(listIdOrTitle);

    const [updatedTasks, updatedLists] = await Promise.all([
      api.getTasks(),
      api.getTaskLists(),
    ]);
    if (updatedTasks) setTasks(updatedTasks);
    if (updatedLists) setTaskLists(updatedLists);
  };

  const handleRenameList = async (listId: string, newTitle: string) => {
    setTaskLists((prev) => prev.map((l) => (l._id === listId ? { ...l, title: newTitle } : l)));
    await api.updateTaskList(listId, { title: newTitle });
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? {
            ...t,
            status: t.status === 'completed' ? 'pending' : 'completed',
            completedAt: t.status === 'completed' ? null : new Date().toISOString(),
          }
          : t
      )
    );
    api.toggleTask(taskId);
  };

  const handleToggleStar = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, starred: !t.starred } : t))
    );
    const target = tasks.find((t) => t._id === taskId);
    if (target) api.updateTask(taskId, { starred: !target.starred });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    if (selectedTask?._id === taskId) setSelectedTask(null);
    api.deleteTask(taskId);
  };

  const handleAddTask = async (listId: string, title: string) => {
    const tempTask: Task = {
      _id: `task_${Date.now()}`,
      userId: user._id,
      title: title.trim(),
      status: 'pending',
      priority: 'medium',
      listId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks((prev) => [tempTask, ...prev]);
    const created = await api.createTask(tempTask);
    if (created) {
      setTasks((prev) => prev.map((t) => (t._id === tempTask._id ? created : t)));
    }
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, ...updates } : t)));
    if (selectedTask?._id === id) {
      setSelectedTask((prev) => (prev ? { ...prev, ...updates } : null));
    }
    api.updateTask(id, updates);
  };

  const handleCreateList = async (title: string) => {
    const created = await api.createTaskList(title);
    if (created) {
      setTaskLists((prev) => [...prev.filter((l) => l._id !== created._id), created]);
      setTickedListIds((prev) => [...prev, created._id]);
      setActiveView(created._id);
    } else {
      const newList: TaskList = {
        _id: `list_${Date.now()}`,
        title,
      };
      setTaskLists((prev) => [...prev, newList]);
      setTickedListIds((prev) => [...prev, newList._id]);
      setActiveView(newList._id);
    }
  };

  const handleReplan = async () => {
    const replanned = await api.replanDay();
    if (replanned) setTasks(replanned);
  };

  const handleAskAI = async (promptText: string, targetSessionId?: string) => {
    const getCurrentLocalTime = () => new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: user.profile?.timezone || 'Asia/Kolkata', timeZoneName: 'short' });

    const activeSessionId = targetSessionId || `session_${new Date().toISOString().substring(0, 10)}`;
    const userMsg: ChatMessage = {
      _id: `msg_${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content: promptText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    const result = await api.sendChatMessage(promptText, targetSessionId, getCurrentLocalTime());
    if (result) {
      setMessages((prev) => [...prev.filter((m) => m._id !== userMsg._id), result.userMsg, result.aiMsg]);
      const [updatedTasks, updatedLists] = await Promise.all([
        api.getTasks(),
        api.getTaskLists(),
      ]);
      if (updatedTasks) setTasks(updatedTasks);
      if (updatedLists) {
        setTaskLists(updatedLists);
        setTickedListIds((prev) => Array.from(new Set([...prev, ...updatedLists.map((l) => l._id)])));
      }
    } else {
      setTimeout(() => {
        const lower = promptText.toLowerCase();
        let aiReply = "I've processed your prompt and updated your Google Tasks board.";

        if (lower.includes('add') || lower.includes('study') || lower.includes('buy')) {
          aiReply = `I've created a new task "${promptText}" under your active Google Tasks list.`;
          handleAddTask(taskLists[0]?._id ?? 'list_basic_info', promptText);
        }

        const aiMsg: ChatMessage = {
          _id: `msg_${Date.now() + 1}`,
          sessionId: 'sess_1',
          role: 'assistant',
          content: aiReply,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);
      }, 500);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#141218] text-[#e3e3e3] overflow-hidden font-sans">
      {activeView === 'ai-chat' ? (
        <FullScreenChat
          onBack={() => setActiveView('all-tasks')}
          messages={messages}
          sessions={sessions}
          onSendMessage={handleAskAI}
        />
      ) : showSettings ? (
        <div className="h-full overflow-y-auto px-4 pt-10 pb-6 md:p-6 bg-[#141218]">
          <div className="flex items-center justify-between pb-4 border-b border-[#2B2930] mb-4">
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs font-semibold text-[#D0BCFF] hover:underline"
            >
              ← Back to Tasks
            </button>
            <h2 className="text-base font-semibold text-[#E6E1E5]">Settings</h2>
          </div>
          <SettingsView
            user={user}
            onUpdateUser={setUser}
            aiConfig={aiConfig}
            onUpdateAIConfig={(cfg) => {
              setAiConfig(cfg);
              api.updateAIConfig(cfg);
            }}
          />
        </div>
      ) : activeView === 'memory' ? (
        <div className="h-full flex flex-col bg-[#141218]">
          <div className="px-4 pt-10 pb-3 border-b border-[#2B2930] flex items-center justify-between">
            <button
              onClick={() => setActiveView('all-tasks')}
              className="text-xs font-semibold text-[#D0BCFF] hover:underline"
            >
              ← Back to Tasks
            </button>
            <h2 className="text-base font-semibold text-[#E6E1E5]">Memory & AI Goals</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MemoryView />
          </div>
        </div>
      ) : isMobile ? (
        <GoogleTasksMobileView
          taskLists={taskLists}
          tasks={tasks}
          user={user}
          onToggleTask={handleToggleTask}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onToggleStar={handleToggleStar}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
          onRenameList={handleRenameList}
          onOpenSettings={() => setShowSettings(true)}
          onOpenMemory={() => setActiveView('memory')}
          onOpenAIChat={() => setActiveView('ai-chat')}
          onAskAI={handleAskAI}
        />
      ) : (
        <>
          {/* 1:1 Google Tasks Header */}
          <GoogleHeader
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            userName={user.profile.name}
          />

          {/* Main Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Collapsible Google Sidebar */}
            {sidebarOpen && (
              <GoogleSidebar
                activeView={activeView}
                setActiveView={(v) => {
                  setActiveView(v);
                  setShowSettings(false);
                }}
                taskLists={taskLists}
                tasks={tasks}
                tickedListIds={tickedListIds}
                onToggleListTicked={handleToggleListTicked}
                onDeleteList={handleDeleteList}
                onCreateList={handleCreateList}
                onCreateTask={() => {
                  const defaultList = taskLists[0]?._id ?? 'list_basic_info';
                  handleAddTask(defaultList, 'New Task');
                }}
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {/* Content: Settings, Memory & AI Goals View, or 1:1 Google Tasks Multi-List Horizontal Board */}
            <main className="flex-1 h-full overflow-hidden relative">
              <GoogleBoardView
                taskLists={taskLists}
                tasks={tasks}
                activeView={activeView}
                tickedListIds={tickedListIds}
                onToggleTask={handleToggleTask}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onToggleStar={handleToggleStar}
                onCreateList={handleCreateList}
                onDeleteList={handleDeleteList}
                onRenameList={handleRenameList}
              />
            </main>
          </div>

          {/* AI Taskbar */}
          <AITaskbar onClick={() => setActiveView('ai-chat')} />
        </>
      )}
    </div>
  );
}
