
import React from 'react';
import { GeneratedClip } from '../types';
import { Play, Pause, Plus, GripVertical } from 'lucide-react';

interface DraggableSidebarItemProps {
  clip: GeneratedClip;
  isPlaying: boolean;
  onPlay: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent, clip: GeneratedClip) => void;
}

const DraggableSidebarItem: React.FC<DraggableSidebarItemProps> = ({ clip, isPlaying, onPlay, onAdd, onDragStart }) => {
  
  const handleDragStart = (e: React.DragEvent) => {
      // Set drag data
      e.dataTransfer.effectAllowed = 'copy';
      // Pass data to parent logic via JSON or just rely on state in AudioEditor
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'sidebar', clip }));
      onDragStart(e, clip);
  };

  return (
    <div 
        draggable
        onDragStart={handleDragStart}
        className="p-3 rounded-xl border border-slate-100 bg-white transition-all group hover:border-indigo-200 hover:shadow-sm cursor-grab active:cursor-grabbing"
    >
        <div className="flex justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                {clip.voiceName}
            </span>
             <div className="text-slate-300 hover:text-indigo-400">
                <GripVertical className="w-4 h-4" />
             </div>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100 italic select-none">
            "{clip.text}"
        </p>
        
        <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
             <button
                onClick={onPlay}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    isPlaying ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
             >
                 {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
             </button>
             <button
                onClick={onAdd}
                className="flex-1 flex items-center justify-center gap-1 bg-slate-900 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors shadow-sm"
             >
                 <Plus className="w-3.5 h-3.5" />
                 Adicionar
             </button>
        </div>
    </div>
  );
};

export default DraggableSidebarItem;
