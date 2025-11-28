import React, { useState, useRef, useEffect } from 'react';
import { GeneratedClip, MergedClip } from '../types';
import { useTimeline } from '../hooks/useTimeline';
import TimelineTrack from './TimelineTrack';
import DraggableSidebarItem from './DraggableSidebarItem';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
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
import { mixAudioTracks } from '../utils/audioUtils';

interface AudioEditorProps {
  sourceClips: GeneratedClip[];
  mergedHistory: MergedClip[];
  onSaveMerged: (clip: MergedClip) => void;
  onDeleteMerged: (id: string) => void;
}

export default function AudioEditor({ sourceClips, mergedHistory, onSaveMerged, onDeleteMerged }: AudioEditorProps) {
  const { timeline, tracks, addClip, removeClip, updateClip, moveClip, addTrack, removeTrack, getTotalDuration, previewMix } = useTimeline();
  const [isProcessing, setIsProcessing] = useState(false);
  const [playPreviewId, setPlayPreviewId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<GeneratedClip | null>(null);
  const [uploadedClips, setUploadedClips] = useState<GeneratedClip[]>([]);
  
  // Zoom State (Pixels per Second)
  // Default 40px = 1 second
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  
  // Timeline Preview State
  const [isPreviewingTimeline, setIsPreviewingTimeline] = useState(false);
  const [timelineAudioUrl, setTimelineAudioUrl] = useState<string | null>(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const timelineAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineUploadInputRef = useRef<HTMLInputElement>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(KeyboardSensor)
  );
  
  // Cleanup preview URL on unmount
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

  const handleZoomIn = () => {
      setPixelsPerSecond(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
      setPixelsPerSecond(prev => Math.max(prev - 10, 10)); // Min 10px per second
  };

  // --- Handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    // Check if dragging from sidebar
    if (active.data.current?.type === 'SourceClip') {
        setActiveDragItem(active.data.current.clip);
    } 
    // Check if dragging from timeline
    else if (active.data.current?.type === 'TimelineClip') {
        setActiveDragItem(active.data.current.clip);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Only handle sorting for TimelineClips (both same-track and cross-track)
    if (active.data.current?.type !== 'TimelineClip') return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeClip = timeline.find(c => c.instanceId === activeId);
    if (!activeClip) return;

    const overClip = timeline.find(c => c.instanceId === overId);
    const isOverTrack = tracks.includes(overId as string);

    // Case 1: Over another clip (Sort)
    if (overClip) {
        // We call moveClip for both same-track and cross-track to ensure real-time visual sorting
        moveClip(activeId as string, overId as string);
    } 
    // Case 2: Over an empty track container (Move to Track)
    else if (isOverTrack) {
        if (activeClip.trackId !== overId) {
             moveClip(activeId as string, overId as string, overId as string);
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // 1. Dropping from Sidebar to a Track
    if (active.data.current?.type === 'SourceClip') {
        // Is dropping on a track container directly?
        const isTrackDrop = tracks.includes(overId as string);
        // Is dropping on a clip inside a track?
        const isClipDrop = timeline.some(t => t.instanceId === overId);
        
        let targetTrack = 'track-1';
        if (isTrackDrop) targetTrack = overId as string;
        else if (isClipDrop) {
            const clip = timeline.find(t => t.instanceId === overId);
            if (clip) targetTrack = clip.trackId;
        }

        if (isTrackDrop || isClipDrop) {
            const clipToAdd = active.data.current.clip as GeneratedClip;
            addClip(clipToAdd, targetTrack);
        }
    } 
    // 2. TimelineClip moves
    // handleDragOver usually handles the visual move, but we enforce consistency here
    else if (active.data.current?.type === 'TimelineClip') {
        const isTrackDrop = tracks.includes(overId as string);
        
        if (isTrackDrop) {
             const activeClip = timeline.find(c => c.instanceId === activeId);
             // Ensure it ends up in the track if dragged over background and wasn't caught by dragOver
             if (activeClip && activeClip.trackId !== overId) {
                 moveClip(activeId as string, overId as string, overId as string);
             }
        } 
    }
  };
  
  const handleToggleTimelinePreview = async () => {
      if (isPreviewingTimeline) {
          // Stop Logic
          if (timelineAudioRef.current) {
              timelineAudioRef.current.pause();
              timelineAudioRef.current.currentTime = 0;
          }
          setIsPreviewingTimeline(false);
          setPreviewCurrentTime(0);
          return;
      }

      // Start Logic
      if (timeline.length === 0) return;

      setIsProcessing(true);
      try {
          const blob = await previewMix();
          if (blob) {
              // Revoke old URL if exists
              if (timelineAudioUrl) URL.revokeObjectURL(timelineAudioUrl);
              
              const url = URL.createObjectURL(blob);
              setTimelineAudioUrl(url);
              
              // Give state a moment to update ref or force strict playback
              setTimeout(() => {
                  if (timelineAudioRef.current) {
                      timelineAudioRef.current.src = url;
                      timelineAudioRef.current.play();
                      setIsPreviewingTimeline(true);
                  }
              }, 50);
          }
      } catch (e) {
          console.error("Preview failed", e);
          alert("Erro ao gerar preview.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleTimelineTimeUpdate = () => {
      if (timelineAudioRef.current) {
          setPreviewCurrentTime(timelineAudioRef.current.currentTime);
      }
  };

  const handleTimelineEnded = () => {
      setIsPreviewingTimeline(false);
      setPreviewCurrentTime(0);
  };

  const handleMerge = async () => {
    if (timeline.length < 1) {
      alert("Adicione clipes para processar.");
      return;
    }

    setIsProcessing(true);
    try {
      // Use the mixing engine
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

    } catch (e) {
      console.error("Merge failed", e);
      alert("Erro ao mixar áudios. Verifique se há conteúdo válido.");
    } finally {
      setIsProcessing(false);
    }
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

  const handleDownload = (clip: MergedClip) => {
      const a = document.createElement('a');
      a.href = clip.audioUrl;
      a.download = `gemini_mix_${clip.id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
          
          // Add to uploaded library so it can be reused
          setUploadedClips(prev => [newClip, ...prev]);
          
          // Add directly to the first track
          if (tracks.length > 0) {
              addClip(newClip, tracks[0]);
          }
      };
      // Reset input
      e.target.value = '';
  };

  const allSourceClips = [...uploadedClips, ...sourceClips];

  // Calculate dynamic ruler length based on duration + padding
  const totalDuration = getTotalDuration();
  // Minimum 5 minutes (300s) or Duration + 1 minute padding
  const rulerMaxTime = Math.max(300, totalDuration + 60);
  const rulerSegments = Math.ceil(rulerMaxTime / 5);

  return (
    <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
    >
        <div className="flex-1 flex flex-col xl:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
        
        {/* LEFT/CENTER: Timeline Area */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
            
            {/* Timeline Container */}
            <div className="flex-1 bg-slate-900 rounded-2xl shadow-xl border border-slate-800 flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center z-10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/30">
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Multi-Track Timeline</h2>
                            <p className="text-[10px] text-slate-500">
                                Duração Total: <span className="text-indigo-400 font-mono">{totalDuration.toFixed(1)}s</span>
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        
                        {/* Zoom Controls */}
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-2">
                            <button 
                                onClick={handleZoomOut}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                title="Zoom Out (-)"
                            >
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[9px] font-mono text-slate-500 px-1 select-none w-10 text-center">
                                {Math.round((pixelsPerSecond / 40) * 100)}%
                            </span>
                            <button 
                                onClick={handleZoomIn}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                title="Zoom In (+)"
                            >
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="h-4 w-px bg-slate-700 mx-1"></div>

                        {/* Play Preview Button */}
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
                                    <>
                                        <StopCircle className="w-3.5 h-3.5" />
                                        Parar Preview
                                    </>
                                ) : (
                                    <>
                                        {isProcessing && !timelineAudioUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                        Ouvir Preview
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="h-4 w-px bg-slate-700 mx-1"></div>

                        <button
                            onClick={() => timelineUploadInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Importar
                        </button>
                        <input 
                            type="file"
                            ref={timelineUploadInputRef}
                            className="hidden"
                            accept="audio/*"
                            onChange={handleTimelineUpload}
                        />

                        <button
                            onClick={addTrack}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nova Faixa
                        </button>
                        <button
                            onClick={handleMerge}
                            disabled={timeline.length < 1 || isProcessing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                timeline.length < 1 || isProcessing
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                            }`}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                            {isProcessing ? 'Mixando...' : 'Renderizar Final'}
                        </button>
                    </div>
                </div>

                {/* Tracks Area */}
                <div className="flex-1 overflow-y-auto bg-slate-900 relative">
                     {/* Timeline Ruler (Visual) */}
                     <div className="h-6 bg-slate-950 border-b border-slate-800 flex items-end select-none sticky top-0 z-20 overflow-hidden">
                         <div className="w-24 border-r border-slate-800 bg-slate-900 flex-shrink-0"></div>
                         <div className="flex">
                             {/* Dynamic Ruler based on content length */}
                             {[...Array(rulerSegments)].map((_, i) => (
                                 <div 
                                    key={i} 
                                    className="flex-shrink-0 border-l border-slate-700 pl-1 text-[9px] font-mono text-slate-500 flex items-end pb-0.5" 
                                    style={{ width: `${5 * pixelsPerSecond}px` }} // Dynamic width based on zoom
                                >
                                     {i * 5}s
                                 </div>
                             ))}
                         </div>
                     </div>

                    <div className="pb-10">
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
                            />
                        ))}
                        
                        {/* Empty State Hint */}
                        {timeline.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 opacity-30 pointer-events-none">
                                <Scissors className="w-12 h-12 text-slate-500 mb-2" />
                                <p className="text-slate-500 text-sm">Arraste clipes para as faixas acima</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Merged History Section */}
            <div className="h-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mixagens Prontas</span>
                    </div>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{mergedHistory.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mergedHistory.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-8">
                            <p className="text-sm">Nenhum áudio finalizado.</p>
                        </div>
                    ) : (
                        mergedHistory.map(merged => (
                            <div key={merged.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{merged.name}</h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {merged.createdAt.toLocaleTimeString()} • {merged.duration.toFixed(1)}s
                                        </p>
                                    </div>
                                    <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-full">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => togglePlay(merged.audioUrl, merged.id)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                                            playPreviewId === merged.id 
                                            ? 'bg-indigo-600 text-white' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {playPreviewId === merged.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        {playPreviewId === merged.id ? 'Pausar' : 'Ouvir'}
                                    </button>
                                    <button
                                        onClick={() => handleDownload(merged)}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Baixar"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDeleteMerged(merged.id)}
                                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>

        {/* RIGHT SIDEBAR: Source Clips */}
        <div className="w-full xl:w-96 border-l border-slate-200 bg-white flex flex-col h-full z-20">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-indigo-500" />
                    Biblioteca de Mídia
                </h3>
                
                {/* File Upload Area */}
                <div className="mt-4 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:bg-slate-50 hover:border-indigo-300 transition-colors relative cursor-pointer group text-center">
                    <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center gap-1">
                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                        <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                            Upload de Áudio Externo
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {allSourceClips.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <p>Biblioteca vazia.</p>
                        <p className="text-xs mt-1">Gere vozes ou faça upload.</p>
                    </div>
                ) : (
                    allSourceClips.map((clip) => (
                        <DraggableSidebarItem 
                            key={`source-${clip.id}`} 
                            clip={clip} 
                            isPlaying={playPreviewId === clip.id}
                            onPlay={() => togglePlay(clip.audioUrl, clip.id)}
                            onAdd={() => addClip(clip, 'track-1')}
                        />
                    ))
                )}
            </div>
        </div>

        {/* Drag Overlay (Visual Follower) */}
        <DragOverlay className="pointer-events-none">
            {activeDragItem ? (
                 <div className="p-2 rounded-lg bg-slate-800 text-white shadow-2xl border border-indigo-500 rotate-2 opacity-90 w-40 ring-2 ring-indigo-400 z-50">
                    <div className="flex justify-between gap-2 mb-1">
                        <span className="text-[9px] font-bold text-white bg-indigo-600 px-1.5 rounded-full uppercase truncate">
                            {activeDragItem.voiceName}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-200 line-clamp-1 italic">
                        "{activeDragItem.text}"
                    </p>
                </div>
            ) : null}
        </DragOverlay>

        {/* Hidden Audio for Editor Playback */}
        <audio ref={audioRef} onEnded={() => setPlayPreviewId(null)} className="hidden" />
        
        {/* Dedicated Hidden Audio for Timeline Preview */}
        <audio 
            ref={timelineAudioRef} 
            onEnded={handleTimelineEnded} 
            onTimeUpdate={handleTimelineTimeUpdate}
            className="hidden" 
        />
        </div>
    </DndContext>
  );
}