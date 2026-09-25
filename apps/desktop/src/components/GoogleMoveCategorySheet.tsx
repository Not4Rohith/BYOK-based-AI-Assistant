import React from 'react';
import { TaskList } from '@ai-task-manager/shared-types';
import { Check, Plus } from 'lucide-react';

interface GoogleMoveCategorySheetProps {
  taskLists: TaskList[];
  currentListId: string;
  onSelectList: (listId: string) => void;
  onCreateNewList: () => void;
  onClose: () => void;
}

export const GoogleMoveCategorySheet: React.FC<GoogleMoveCategorySheetProps> = ({
  taskLists,
  currentListId,
  onSelectList,
  onCreateNewList,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Material 3 Dark Bottom Sheet Container */}
      <div className="relative w-full max-w-md bg-[#1E1B24] rounded-t-[28px] border-t border-[#36343B] p-6 text-[#E6E1E5] space-y-4 shadow-2xl animate-slideUp">
        {/* Handle Bar */}
        <div className="w-8 h-1 bg-[#49454F] rounded-full mx-auto mb-2" />

        <h3 className="text-sm font-medium text-[#CAC4D0] px-2">Move task to</h3>

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {taskLists.map((list) => {
            const isSelected = list._id === currentListId;
            return (
              <button
                key={list._id}
                onClick={() => {
                  onSelectList(list._id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors ${
                  isSelected ? 'bg-[#36343B] text-[#E8DEF8]' : 'hover:bg-[#2B2930] text-[#E6E1E5]'
                }`}
              >
                <span>{list.title}</span>
                {isSelected && <Check className="w-4 h-4 text-[#D0BCFF]" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            onClose();
            onCreateNewList();
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-[#D0BCFF] hover:bg-[#2B2930] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create new list</span>
        </button>
      </div>
    </div>
  );
};
