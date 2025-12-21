
import React, { useState } from 'react';
import { TimelineClip } from '../types';
import { Trash2, GripVertical, Settings, X } from 'lucide-react';

interface TimelineClipItemProps {
  clip: TimelineClip;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TimelineClip>) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  pixelsPerSecond: number; 
}

const TimelineClipItem: React.FC<TimelineClipItemProps> = ({ clip, onRemove, onUpdate, onDragStart, onDrop, pixelsPerSecond }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [offsetValue, setOffsetValue] = useState(clip.startOffset || 0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'timeline', id: clip.instanceId }));
      onDragStart(e, clip.instanceId);
  };

  const handleDragEnd = () => {
      setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Allow dropping
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Stop it from bubbling to track
      onDrop(e, clip.instanceId);
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) setOffsetValue(val);
  };

  const saveOffset = () => {
      onUpdate(clip.instanceId, { startOffset: offsetValue });
      setIsSettingsOpen(false);
  };

  const offsetWidth = (clip.startOffset || 0) * pixelsPerSecond;
  const clipWidth = Math.max(60, (clip.duration || 5) * pixelsPerSecond);

  return (
    <div
      draggable={!isSettingsOpen}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`group relative flex-shrink-0 flex flex-col justify-center p-2 rounded-lg border shadow-sm transition-all select-none h-[90px] overflow-hidden cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50/10' : 'bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-750'
      }`}
      style={{
        marginLeft: `${offsetWidth}px`,
        width: `${clipWidth}px`,
      }}
    >
      {/* Offset Visual */}
      {clip.startOffset && clip.startOffset > 0 && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-slate-600/50 flex items-center justify-center text-[9px] text-slate-500 font-mono pointer-events-none"
            style={{ width: `${offsetWidth}px`, left: `-${offsetWidth}px` }}
          >
              <span className="-mt-5 bg-slate-900 px-1 rounded shadow-sm text-slate-400">+{clip.startOffset}s</span>
          </div>
      )}

      {/* Color Accent */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${clip.color} opacity-90 rounded-l-lg`}></div>

      {/* Handle */}
      <div className="absolute top-2 right-2 text-slate-600 hover:text-slate-400 p-1 rounded hover:bg-slate-700/50">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col pl-2 pr-4 justify-center">
        <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-slate-200 truncate max-w-[120px] bg-slate-900/60 px-2 py-0.5 rounded shadow-sm border border-slate-700/50">
                {clip.voiceName}
            </span>
        </div>
        <p className="text-[11px] text-slate-400 truncate leading-tight font-medium opacity-90">"{clip.text}"</p>
        <div className="mt-1.5 text-[9px] font-mono text-slate-500 bg-slate-900/30 self-start px-1 rounded">
             {(clip.duration || 0).toFixed(1)}s
        </div>
      </div>

      {/* Hover Actions */}
      {!isDragging && (
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 z-20">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1 bg-slate-700 text-slate-400 hover:bg-indigo-600 hover:text-white rounded shadow-sm border border-slate-600 transition-colors"
                title="Configurar"
            >
                <Settings className="w-3 h-3" />
            </button>
            <button 
                onClick={() => onRemove(clip.instanceId)}
                className="p-1 bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white rounded shadow-sm border border-slate-600 transition-colors"
                title="Remover"
            >
                <Trash2 className="w-3 h-3" />
            </button>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 w-48 text-slate-800 cursor-default" onPointerDown={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Ajustar Clipe</span>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
              </div>
              <div className="space-y-3">
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Delay (s)</label>
                      <input 
                        type="number" step="0.1" min="0"
                        value={offsetValue}
                        onChange={handleOffsetChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none"
                      />
                  </div>
                  <button onClick={saveOffset} className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg">Confirmar</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default TimelineClipItem;
