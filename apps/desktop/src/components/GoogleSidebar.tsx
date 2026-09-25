import React, { useState } from 'react';
import { Plus, CheckSquare, Star, ChevronDown, ChevronUp, Check, Settings, Brain } from 'lucide-react';
import { TaskList, Task } from '@ai-task-manager/shared-types';

export type SidebarViewMode = 'all-tasks' | 'starred' | 'memory' | string;

interface GoogleSidebarProps {
  activeView: SidebarViewMode;
  setActiveView: (view: SidebarViewMode) => void;
  taskLists: TaskList[];
  tasks: Task[];
  tickedListIds: string[];
  onToggleListTicked: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: (title: string) => void;
  onCreateTask: () => void;
  onOpenSettings: () => void;
}

export const GoogleSidebar: React.FC<GoogleSidebarProps> = ({
  activeView,
  setActiveView,
  taskLists,
  tasks,
  tickedListIds,
  onToggleListTicked,
  onDeleteList,
  onCreateList,
  onCreateTask,
  onOpenSettings,
}) => {
  const [listsOpen, setListsOpen] = useState(true);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const getListTaskCount = (listId: string) => {
    return tasks.filter((t) => t.listId === listId && t.status !== 'completed').length;
  };

  const handleCreateListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    onCreateList(newListTitle.trim());
    setNewListTitle('');
    setIsCreatingList(false);
  };

  return (
    <aside className="w-60 h-full bg-[#1b1b1b] border-r border-white/[0.06] flex flex-col justify-between p-3 select-none shrink-0 z-20">
      <div className="space-y-4">
        {/* Large + Create Button */}
        <div className="px-1 pt-1">
          <button
            onClick={onCreateTask}
            className="flex items-center space-x-3 px-5 py-3 rounded-2xl bg-[#282828] hover:bg-[#333333] border border-white/10 text-[#e3e3e3] text-sm font-medium transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5 text-blue-400" />
            <span>Create</span>
          </button>
        </div>

        {/* Primary View Items */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveView('all-tasks')}
            className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full text-xs font-medium transition-all ${
              activeView === 'all-tasks'
                ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                : 'text-[#c4c7c5] hover:bg-white/[0.08]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>All tasks</span>
          </button>

          <button
            onClick={() => setActiveView('starred')}
            className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full text-xs font-medium transition-all ${
              activeView === 'starred'
                ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                : 'text-[#c4c7c5] hover:bg-white/[0.08]'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Starred</span>
          </button>

          <button
            onClick={() => setActiveView('memory')}
            className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full text-xs font-medium transition-all ${
              activeView === 'memory'
                ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                : 'text-[#c4c7c5] hover:bg-white/[0.08]'
            }`}
          >
            <Brain className="w-4 h-4 text-indigo-400" />
            <span>Memory & AI Goals</span>
          </button>
        </div>

        {/* Lists Accordion */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={() => setListsOpen(!listsOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-[#c4c7c5] hover:bg-white/[0.04] rounded-lg transition-colors"
          >
            <span>Lists</span>
            {listsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {listsOpen && (
            <div className="mt-1 space-y-0.5 max-h-72 overflow-y-auto pr-0.5">
              {taskLists.map((list) => {
                const count = getListTaskCount(list._id);
                const isActive = activeView === list._id;
                const isTicked = tickedListIds.includes(list._id);

                return (
                  <div
                    key={list._id}
                    onClick={() => setActiveView(list._id)}
                    className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-normal transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                        : 'text-[#e3e3e3] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      {/* Interactive Checkbox for Toggling List Column Visibility */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleListTicked(list._id);
                        }}
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                          isTicked
                            ? 'bg-[#004a77] border border-blue-400 text-white font-bold'
                            : 'border border-slate-500 hover:border-slate-300 text-transparent'
                        }`}
                        title={isTicked ? 'Hide list from board' : 'Display list on board'}
                      >
                        {isTicked && <Check className="w-3 h-3 text-blue-200 stroke-[3]" />}
                      </button>

                      <span className="truncate">{list.title}</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {count > 0 && (
                        <span className="text-[11px] text-slate-400 font-mono">{count}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Create new list inline */}
              {isCreatingList ? (
                <form onSubmit={handleCreateListSubmit} className="px-2 pt-1">
                  <input
                    type="text"
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onBlur={() => {
                      if (!newListTitle.trim()) setIsCreatingList(false);
                    }}
                    placeholder="List name..."
                    className="w-full bg-[#282828] border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-[#e3e3e3] focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setIsCreatingList(true)}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs text-[#c4c7c5] hover:bg-white/[0.08] transition-colors"
                >
                  <Plus className="w-4 h-4 text-slate-400" />
                  <span>Create new list</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Footer */}
      <div className="pt-2 border-t border-white/[0.06]">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs text-[#c4c7c5] hover:bg-white/[0.08] transition-colors"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
