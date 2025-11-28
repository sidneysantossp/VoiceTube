import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { TimelineClip } from '../types';
import TimelineClipItem from './TimelineClipItem';
import { Trash2 } from 'lucide-react';

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
  const { setNodeRef, isOver } = useDroppable({
    id: trackId,
  });

  return (
    <div className="flex items-stretch group/track">
        {/* Track Header */}
        <div className="w-24 bg-slate-800 border-r border-slate-700 flex flex-col justify-center items-center p-2 flex-shrink-0 relative z-10 shadow-md">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
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

        {/* Track Content (Droppable) */}
        <div 
            ref={setNodeRef}
            className={`flex-1 min-h-[110px] p-2 flex items-center gap-2 overflow-x-auto custom-scrollbar transition-colors ${
                isOver ? 'bg-indigo-900/10 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]' : 'bg-slate-900/50'
            } border-b border-slate-800 relative`}
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
                        Solte áudio aqui
                    </span>
                </div>
            )}
        </div>
    </div>
  );
};

export default TimelineTrack;