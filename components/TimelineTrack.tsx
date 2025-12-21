
import React from 'react';
import { TimelineClip } from '../types';
import TimelineClipItem from './TimelineClipItem';
import { Trash2, GripHorizontal, ArrowDownToLine } from 'lucide-react';

interface TimelineTrackProps {
  trackId: string;
  clips: TimelineClip[];
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  removeTrack: (id: string) => void;
  canRemoveTrack: boolean;
  pixelsPerSecond: number;
  onClipDragStart: (e: React.DragEvent, id: string) => void;
  onClipDrop: (e: React.DragEvent, targetId: string) => void;
  onTrackDrop: (e: React.DragEvent, trackId: string) => void;
}

const TimelineTrack: React.FC<TimelineTrackProps> = ({ 
    trackId, clips, removeClip, updateClip, removeTrack, canRemoveTrack, pixelsPerSecond,
    onClipDragStart, onClipDrop, onTrackDrop
}) => {

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      onTrackDrop(e, trackId);
  };

  return (
    <div className="flex items-stretch mb-3 last:mb-0 drop-shadow-sm group/track">
        {/* Header */}
        <div className="w-24 bg-slate-800 border-r border-slate-700 rounded-l-lg flex flex-col justify-center items-center p-2 flex-shrink-0 relative z-20 shadow-md select-none">
             <div className="text-slate-500 mb-2 p-1 bg-slate-900/50 rounded-md">
                <GripHorizontal className="w-4 h-4" />
             </div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 text-center leading-tight">
                {trackId.replace('track-', 'Faixa ')}
             </div>
             <div className="text-[10px] font-mono text-slate-600 bg-slate-900 px-1.5 rounded">
                 {clips.length} clipes
             </div>
             {canRemoveTrack && (
                 <button onClick={() => removeTrack(trackId)} className="mt-2 p-1 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors">
                     <Trash2 className="w-3 h-3" />
                 </button>
             )}
        </div>

        {/* Content / Drop Zone */}
        <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex-1 min-h-[120px] p-2 flex items-center gap-2 overflow-x-auto custom-scrollbar bg-slate-900/50 border border-slate-800 border-l-0 rounded-r-lg relative z-10 transition-colors hover:bg-slate-800/30"
        >
             {/* Ruler Lines */}
             <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: `${pixelsPerSecond * 5}px 100%` }}></div>
             <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: `${pixelsPerSecond}px 100%` }}></div>

             {clips.map((clip, index) => (
                <TimelineClipItem 
                    key={clip.instanceId} 
                    clip={clip} 
                    onRemove={removeClip}
                    onUpdate={updateClip}
                    pixelsPerSecond={pixelsPerSecond}
                    onDragStart={onClipDragStart}
                    onDrop={onClipDrop}
                />
             ))}
            
            {/* Empty State / Drop Hint */}
            {clips.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="border-2 border-dashed border-slate-600 rounded-lg px-4 py-2 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <ArrowDownToLine className="w-4 h-4" /> Solte áudio aqui
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default TimelineTrack;
