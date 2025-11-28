import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TimelineClip } from '../types';
import TimelineClipItem from './TimelineClipItem';
import { Trash2, GripHorizontal } from 'lucide-react';

interface TimelineTrackProps {
  trackId: string;
  clips: TimelineClip[];
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  removeTrack: (id: string) => void;
  canRemoveTrack: boolean;
  pixelsPerSecond: number; // Prop for zoom scale
}

const TimelineTrack: React.FC<TimelineTrackProps> = ({ trackId, clips, removeClip, updateClip, removeTrack, canRemoveTrack, pixelsPerSecond }) => {
  // 1. Sortable Hook for the Track itself (Vertical Reordering)
  const {
    attributes,
    listeners,
    setNodeRef: setTrackRef,
    transform,
    transition,
    isDragging: isTrackDragging
  } = useSortable({
    id: trackId,
    data: {
      type: 'Track',
      id: trackId
    }
  });

  // 2. Droppable Hook for the content area (Dropping clips into the track)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: trackId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isTrackDragging ? 0.5 : 1,
    zIndex: isTrackDragging ? 100 : 'auto',
    position: 'relative' as 'relative',
  };

  return (
    <div 
      ref={setTrackRef} 
      style={style} 
      className="flex items-stretch group/track mb-2 last:mb-0"
    >
        {/* Track Header (Drag Handle & Controls) */}
        <div className="w-24 bg-slate-800 border-r border-slate-700 rounded-l-lg flex flex-col justify-center items-center p-2 flex-shrink-0 relative z-10 shadow-md">
             {/* Track Drag Handle */}
             <div 
               {...attributes} 
               {...listeners} 
               className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-indigo-400 mb-2 p-1"
               title="Arrastar para reordenar faixa"
             >
                <GripHorizontal className="w-4 h-4" />
             </div>

             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 text-center leading-tight">
                {trackId.replace('track-', 'Faixa ')}
             </div>
             <div className="text-[10px] font-mono text-slate-600">
                 {clips.length} clipes
             </div>
             
             {canRemoveTrack && (
                 <button 
                    onClick={() => removeTrack(trackId)}
                    className="mt-2 p-1 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors"
                    title="Remover faixa"
                 >
                     <Trash2 className="w-3 h-3" />
                 </button>
             )}
        </div>

        {/* Track Content (Droppable Area for Clips) */}
        <div 
            ref={setDroppableRef}
            className={`flex-1 min-h-[110px] p-2 flex items-center gap-2 overflow-x-auto custom-scrollbar transition-all duration-200 rounded-r-lg ${
                isOver 
                ? 'bg-indigo-500/10 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)] border-indigo-500' 
                : 'bg-slate-900/50 border-slate-800'
            } border border-l-0 relative`}
        >
             {/* --- Visual Time Grid --- */}
             
             {/* 5-Second Markers (Prominent) */}
             <div className="absolute inset-0 pointer-events-none opacity-20" 
                  style={{
                      backgroundImage: 'linear-gradient(90deg, #6366f1 1px, transparent 1px)', // Indigo-500
                      backgroundSize: `${pixelsPerSecond * 5}px 100%` 
                  }}
             ></div>

             {/* 1-Second Markers (Subtle) */}
             <div className="absolute inset-0 pointer-events-none opacity-5" 
                  style={{
                      backgroundImage: 'linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', // Slate-300
                      backgroundSize: `${pixelsPerSecond}px 100%` 
                  }}
             ></div>

             {/* ------------------------- */}

             <SortableContext 
                items={clips.map(c => c.instanceId)}
                strategy={horizontalListSortingStrategy}
            >
                {clips.map((clip, index) => (
                    <TimelineClipItem 
                        key={clip.instanceId} 
                        clip={clip} 
                        index={index}
                        onRemove={removeClip}
                        onUpdate={updateClip}
                        onPlay={() => {}}
                        pixelsPerSecond={pixelsPerSecond}
                    />
                ))}
            </SortableContext>
            
            {clips.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold opacity-50">
                        {isOver ? 'Soltar Aqui' : 'Solte áudio aqui'}
                    </span>
                </div>
            )}
        </div>
    </div>
  );
};

export default TimelineTrack;