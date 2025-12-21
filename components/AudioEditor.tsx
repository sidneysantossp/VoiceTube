import React, { useState, useRef, useEffect } from 'react';
import { GeneratedClip, MergedClip } from '../types';
import { useTimeline } from '../hooks/useTimeline';
import TimelineTrack from './TimelineTrack';
import DraggableSidebarItem from './DraggableSidebarItem';
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Layers, 
  Loader2, 
  FileAudio,
  CheckCircle2,
  Music,
  Scissors,
  Plus,
  Upload,
  PlayCircle,
  StopCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface AudioEditorProps {
  sourceClips: GeneratedClip[];
  mergedHistory: MergedClip[];
  onSaveMerged: (clip: MergedClip) => void;
  onDeleteMerged: (id: string) => void;
}

export default function AudioEditor({ sourceClips, mergedHistory, onSaveMerged, onDeleteMerged }: AudioEditorProps) {
  const { 
    timeline, 
    tracks, 
    addClip, 
    removeClip, 
    updateClip, 
    moveClipToTrack,
    swapClips,
    addTrack, 
    removeTrack, 
    getTotalDuration, 
    previewMix 
  } = useTimeline();

  const [isProcessing, setIsProcessing] = useState(false);
  const [playPreviewId, setPlayPreviewId] = useState<string | null>(null);
  
  // Drag State (for visual feedback)
  const [draggedItem, setDraggedItem] = useState<{ type: 'sidebar' | 'timeline', id?: string } | null>(null);

  const [uploadedClips, setUploadedClips] = useState<GeneratedClip[]>([]);
  
  // Zoom State
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  
  // Timeline Preview State
  const [isPreviewingTimeline, setIsPreviewingTimeline] = useState(false);
  const [timelineAudioUrl, setTimelineAudioUrl] = useState<string | null>(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const timelineAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
        if (timelineAudioUrl) URL.revokeObjectURL(timelineAudioUrl);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleZoomIn = () => setPixelsPerSecond(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setPixelsPerSecond(prev => Math.max(prev - 10, 10));

  // --- NATIVE DND HANDLERS ---

  // Called when dragging starts on a Sidebar Item or Timeline Clip
  const handleClipDragStart = (e: React.DragEvent, idOrClip: string | GeneratedClip) => {
      // Determine type based on argument
      if (typeof idOrClip === 'string') {
          setDraggedItem({ type: 'timeline', id: idOrClip });
      } else {
          setDraggedItem({ type: 'sidebar' });
      }
  };

  // Called when dropping onto a TRACK (Background)
  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      try {
          const dataStr = e.dataTransfer.getData('application/json');
          if (!dataStr) return;
          const data = JSON.parse(dataStr);

          if (data.type === 'sidebar') {
              // Add new clip
              addClip(data.clip, trackId);
          } else if (data.type === 'timeline') {
              // Move existing clip to this track (append)
              moveClipToTrack(data.id, trackId);
          }
      } catch (err) {
          console.error("Drop Error:", err);
      } finally {
          setDraggedItem(null);
      }
  };

  // Called when dropping onto another CLIP (Swap/Reorder)
  const handleClipDrop = (e: React.DragEvent, targetClipId: string) => {
      e.preventDefault();
      try {
          const dataStr = e.dataTransfer.getData('application/json');
          if (!dataStr) return;
          const data = JSON.parse(dataStr);

          if (data.type === 'timeline') {
              // Swap positions
              if (data.id !== targetClipId) {
                  swapClips(data.id, targetClipId);
              }
          } 
          // Note: Sidebar drops on clips currently handled by bubbling to track 
          // because e.stopPropagation in TimelineClipItem might prevent it unless logic added.
          // For now, TimelineClipItem prevents bubbling, so we should allow sidebar drop there too?
          // Actually, let's keep it simple: Dragging Sidebar -> Clip does nothing or swaps?
          // Sidebar -> Clip implies "Insert Here", but Swap is for existing.
          // Let's allow Sidebar drops on clips to just add to the track of that clip.
          else if (data.type === 'sidebar') {
             // Find track of target clip
             const targetClip = timeline.find(c => c.instanceId === targetClipId);
             if (targetClip) {
                 addClip(data.clip, targetClip.trackId);
             }
          }
      } catch (err) {
           console.error("Clip Drop Error:", err);
      } finally {
          setDraggedItem(null);
      }
  };

  // --- PLAYER & TOOLBAR ---

  const handleToggleTimelinePreview = async () => {
      if (isPreviewingTimeline) {
          if (timelineAudioRef.current) {
              timelineAudioRef.current.pause();
              timelineAudioRef.current.currentTime = 0;
          }
          setIsPreviewingTimeline(false);
          setPreviewCurrentTime(0);
          return;
      }
      if (timeline.length === 0) return;
      setIsProcessing(true);
      try {
          const blob = await previewMix();
          if (blob) {
              if (timelineAudioUrl) URL.revokeObjectURL(timelineAudioUrl);
              const url = URL.createObjectURL(blob);
              setTimelineAudioUrl(url);
              setTimeout(() => {
                  if (timelineAudioRef.current) {
                      timelineAudioRef.current.src = url;
                      timelineAudioRef.current.play();
                      setIsPreviewingTimeline(true);
                  }
              }, 50);
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao gerar preview.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleMerge = async () => {
    if (timeline.length < 1) { alert("Adicione clipes para processar."); return; }
    setIsProcessing(true);
    try {
      // Use helper to mix
      // We need to pass the current timeline
      // Note: mixAudioTracks is imported from utils
      const { mixAudioTracks } = await import('../utils/audioUtils');
      const mergedBlob = await mixAudioTracks(timeline);
      
      const mergedUrl = URL.createObjectURL(mergedBlob);
      const totalDur = getTotalDuration();
      const newMergedClip: MergedClip = {
        id: `merged-${Date.now()}`,
        name: `Mixagem Completa ${mergedHistory.length + 1}`,
        audioUrl: mergedUrl,
        createdAt: new Date(),
        duration: totalDur,
        clipCount: timeline.length
      };
      onSaveMerged(newMergedClip);
      alert("Áudio mixado e salvo com sucesso!");
    } catch (e) { console.error(e); alert("Erro ao mixar áudios."); } finally { setIsProcessing(false); }
  };

  const togglePlay = (url: string, id: string) => {
    if (audioRef.current) {
        if (playPreviewId === id && !audioRef.current.paused) {
            audioRef.current.pause();
            setPlayPreviewId(null);
        } else {
            audioRef.current.src = url;
            audioRef.current.play();
            setPlayPreviewId(id);
        }
    }
  };

  const handleTimelineUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
          const newClip: GeneratedClip = {
              id: `upload-direct-${Date.now()}`,
              text: file.name,
              voiceName: 'Importação Direta',
              audioUrl: url,
              createdAt: new Date(),
              duration: audio.duration
          };
          setUploadedClips(prev => [newClip, ...prev]);
          if (tracks.length > 0) addClip(newClip, tracks[0]);
      };
      e.target.value = '';
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
          const newClip: GeneratedClip = {
              id: `upload-${Date.now()}`,
              text: file.name,
              voiceName: 'Upload Externo',
              audioUrl: url,
              createdAt: new Date(),
              duration: audio.duration
          };
          setUploadedClips(prev => [newClip, ...prev]);
      };
  };

  const allSourceClips = [...uploadedClips, ...sourceClips];
  const totalDuration = getTotalDuration();
  const rulerMaxTime = Math.max(300, totalDuration + 60);
  const rulerSegments = Math.ceil(rulerMaxTime / 5);

  return (
    <div className="flex-1 flex flex-col xl:flex-row h-full lg:h-[calc(100vh-4rem)] overflow-y-auto lg:overflow-hidden bg-slate-50">
        
        {/* Timeline Area */}
        <div className="flex-1 flex flex-col p-4 lg:p-6 gap-6 min-h-[60vh] lg:min-h-0 lg:overflow-hidden">
            <div className="flex-1 bg-slate-900 rounded-2xl shadow-xl border border-slate-800 flex flex-col overflow-hidden relative min-h-[400px]">
                {/* Header Toolbar */}
                <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center z-10 backdrop-blur-md gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/30">
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Multi-Track Editor</h2>
                            <p className="text-[10px] text-slate-500">
                                Duração Total: <span className="text-indigo-400 font-mono">{totalDuration.toFixed(1)}s</span>
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-2">
                            <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
                            <span className="text-[9px] font-mono text-slate-500 px-1 select-none w-8 sm:w-10 text-center">{Math.round((pixelsPerSecond / 40) * 100)}%</span>
                            <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1"></div>
                        <div className="flex items-center gap-2 mr-2">
                             {isPreviewingTimeline && (
                                <span className="text-xs font-mono text-indigo-400 animate-pulse bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                    {formatTime(previewCurrentTime)}
                                </span>
                             )}
                            <button
                                onClick={handleToggleTimelinePreview}
                                disabled={timeline.length < 1 || isProcessing}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    isPreviewingTimeline
                                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 hover:bg-rose-500/20'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isPreviewingTimeline ? (
                                    <> <StopCircle className="w-3.5 h-3.5" /> Parar </>
                                ) : (
                                    <> {isProcessing && !timelineAudioUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Preview </>
                                )}
                            </button>
                        </div>
                        <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1"></div>
                        <div className="flex gap-2">
                            <button onClick={() => timelineUploadInputRef.current?.click()} className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 flex items-center gap-1">
                                <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importar</span>
                            </button>
                            <input type="file" ref={timelineUploadInputRef} className="hidden" accept="audio/*" onChange={handleTimelineUpload}/>
                            <button onClick={addTrack} className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Faixa</span>
                            </button>
                            <button onClick={handleMerge} disabled={timeline.length < 1 || isProcessing} className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-sm transition-all ${timeline.length < 1 || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'}`}>
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />} <span className="hidden sm:inline">Renderizar Final</span><span className="sm:hidden">Salvar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tracks Area */}
                <div className="flex-1 overflow-y-auto bg-slate-900 relative">
                     {/* Ruler */}
                     <div className="h-6 bg-slate-950 border-b border-slate-800 flex items-end select-none sticky top-0 z-20 overflow-hidden">
                         <div className="w-24 border-r border-slate-800 bg-slate-900 flex-shrink-0"></div>
                         <div className="flex">
                             {[...Array(rulerSegments)].map((_, i) => (
                                 <div key={i} className="flex-shrink-0 border-l border-slate-700 pl-1 text-[9px] font-mono text-slate-500 flex items-end pb-0.5" style={{ width: `${5 * pixelsPerSecond}px` }}>
                                     {i * 5}s
                                 </div>
                             ))}
                         </div>
                     </div>

                    <div className="pb-10 pt-2 px-2">
                        {tracks.map((trackId) => (
                            <TimelineTrack 
                                key={trackId}
                                trackId={trackId}
                                clips={timeline.filter(c => c.trackId === trackId)}
                                removeClip={removeClip}
                                updateClip={updateClip}
                                removeTrack={removeTrack}
                                canRemoveTrack={tracks.length > 1}
                                pixelsPerSecond={pixelsPerSecond}
                                onClipDragStart={handleClipDragStart}
                                onClipDrop={handleClipDrop}
                                onTrackDrop={handleTrackDrop}
                            />
                        ))}
                        
                        {timeline.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 opacity-30 pointer-events-none">
                                <Scissors className="w-12 h-12 text-slate-500 mb-2" />
                                <p className="text-slate-500 text-sm">Arraste clipes para as faixas</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Merged History */}
            <div className="h-auto xl:h-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mixagens Prontas</span>
                    </div>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{mergedHistory.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] xl:max-h-none">
                    {mergedHistory.length === 0 ? <div className="col-span-full text-center text-slate-400 py-8 text-sm">Nenhum áudio finalizado.</div> : mergedHistory.map(merged => (
                        <div key={merged.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div><h4 className="font-bold text-slate-800 text-sm">{merged.name}</h4><p className="text-xs text-slate-500 mt-1">{merged.createdAt.toLocaleTimeString()} • {merged.duration.toFixed(1)}s</p></div>
                                <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-full"><CheckCircle2 className="w-4 h-4" /></div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button onClick={() => togglePlay(merged.audioUrl, merged.id)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${playPreviewId === merged.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    {playPreviewId === merged.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {playPreviewId === merged.id ? 'Pausar' : 'Ouvir'}
                                </button>
                                <button onClick={() => {const a = document.createElement('a'); a.href = merged.audioUrl; a.download = `gemini_mix_${merged.id}.wav`; document.body.appendChild(a); a.click(); document.body.removeChild(a);}} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                                <button onClick={() => onDeleteMerged(merged.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Sidebar */}
        <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-slate-200 bg-white flex flex-col h-[400px] xl:h-full z-20 shrink-0">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileAudio className="w-4 h-4 text-indigo-500" /> Biblioteca de Mídia</h3>
                <div className="mt-4 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:bg-slate-50 hover:border-indigo-300 transition-colors relative cursor-pointer group text-center">
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                    <div className="flex flex-col items-center gap-1"><Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" /><span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Upload de Áudio Externo</span></div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {allSourceClips.length === 0 ? <div className="text-center py-10 text-slate-400"><p>Biblioteca vazia.</p></div> : allSourceClips.map((clip) => (
                    <DraggableSidebarItem 
                        key={`source-${clip.id}`} 
                        clip={clip} 
                        isPlaying={playPreviewId === clip.id} 
                        onPlay={() => togglePlay(clip.audioUrl, clip.id)} 
                        onAdd={() => addClip(clip, 'track-1')}
                        onDragStart={handleClipDragStart}
                    />
                ))}
            </div>
        </div>

        <audio ref={audioRef} onEnded={() => setPlayPreviewId(null)} className="hidden" />
        <audio ref={timelineAudioRef} onEnded={() => {setIsPreviewingTimeline(false); setPreviewCurrentTime(0);}} onTimeUpdate={() => timelineAudioRef.current && setPreviewCurrentTime(timelineAudioRef.current.currentTime)} className="hidden" />
    </div>
  );
}