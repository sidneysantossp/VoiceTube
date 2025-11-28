import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TimelineClip } from '../types';
import { Trash2, GripVertical, Settings, ChevronRight, X } from 'lucide-react';

interface TimelineClipItemProps {
  clip: TimelineClip;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TimelineClip>) => void;
  onPlay: (url: string) => void;
  index: number;
  pixelsPerSecond: number; // Prop for zoom scale
}

const TimelineClipItem: React.FC<TimelineClipItemProps> = ({ clip, onRemove, onUpdate, onPlay, index, pixelsPerSecond }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [offsetValue, setOffsetValue] = useState(clip.startOffset || 0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
      id: clip.instanceId,
      data: {
          type: 'TimelineClip',
          clip: clip
      },
      disabled: isSettingsOpen // Disable drag when settings are open
  });

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
          setOffsetValue(val);
      }
  };

  const saveOffset = () => {
      onUpdate(clip.instanceId, { startOffset: offsetValue });
      setIsSettingsOpen(false);
  };

  const offsetWidth = (clip.startOffset || 0) * pixelsPerSecond;
  // Ensure minimum visual width so it doesn't disappear at low zooms
  const clipWidth = Math.max(20, (clip.duration || 5) * pixelsPerSecond);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Add visual margin for the offset/gap
    marginLeft: `${offsetWidth}px`,
    width: `${clipWidth}px`
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex-shrink-0 flex items-center gap-2 p-2 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 transition-all select-none ${
          isDragging ? 'bg-slate-700 shadow-2xl z-50 ring-2 ring-indigo-500' : 'bg-slate-800'
      }`}
    >
      {/* Visual Offset Indicator (Dashed Line) */}
      {clip.startOffset && clip.startOffset > 0 && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-slate-600/50 flex items-center justify-center text-[9px] text-slate-500 font-mono"
            style={{ width: `${offsetWidth}px`, left: `-${offsetWidth}px` }}
          >
              <span className="-mt-4 bg-slate-900 px-1 rounded">+{clip.startOffset}s</span>
          </div>
      )}

      {/* Visual Indicator Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${clip.color} opacity-80 rounded-b-lg`}></div>

      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-200 truncate max-w-[120px] bg-slate-900/50 px-1.5 rounded">
                {clip.voiceName}
            </span>
             <span className="text-[9px] font-mono text-slate-400">
                {(clip.duration || 0).toFixed(1)}s
            </span>
        </div>
        
        <p className="text-[10px] text-slate-400 truncate leading-tight opacity-80">"{clip.text}"</p>
      </div>

      {/* Actions (Hover) */}
      <div className="absolute -top-3 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100 z-20">
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 bg-slate-700 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-full shadow-sm"
            title="Ajustar posição"
        >
            <Settings className="w-3 h-3" />
        </button>
        <button 
            onClick={() => onRemove(clip.instanceId)}
            className="p-1 bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white rounded-full shadow-sm"
        >
            <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Settings Popover */}
      {isSettingsOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 w-48 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-600">Ajustar Posição</span>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                  </button>
              </div>
              <div className="space-y-2">
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Delay Inicial (s)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        value={offsetValue}
                        onChange={handleOffsetChange}
                        className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                  </div>
                  <button 
                    onClick={saveOffset}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 rounded transition-colors"
                  >
                      Aplicar
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default TimelineClipItem;