import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Wand2, 
  AudioWaveform,
  Loader2,
  History,
  Settings2,
  Eraser,
  FileAudio,
  Mic,
  ChevronDown,
  Check,
  Gauge,
  Plus,
  GripVertical,
  X,
  Scissors,
  LogOut
} from 'lucide-react';
import { INITIAL_VOICES, VoiceOption, GeneratedClip, ScriptBlock, MergedClip } from './types';
import { createWavBlob, base64ToArrayBuffer, processAudioBlob } from './utils/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import VoiceCloning from './components/VoiceCloning';
import AudioEditor from './components/AudioEditor';

const DEFAULT_CONFIG = {
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  speed: 1.0
};

const STORAGE_KEYS = {
  CONFIG: 'gemini_voice_model_config',
  VOICES: 'gemini_voice_custom_voices',
  HISTORY: 'gemini_voice_history_clips',
  MERGED: 'gemini_voice_merged_clips'
};

export default function App() {
  // --- AUTH STATE ---
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoadingSession(false);
      })
      .catch((err) => {
        console.warn("Supabase session check failed:", err);
        setLoadingSession(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- APP STATE ---

  // Navigation State
  const [currentView, setCurrentView] = useState<'tts' | 'cloning' | 'editor'>('tts');

  // State
  // Replace simple text string with Blocks system
  const [blocks, setBlocks] = useState<ScriptBlock[]>([{ id: 'init-1', text: '' }]);
  
  // --- STATE INITIALIZATION WITH PERSISTENCE ---

  // 1. Voices
  const [voices, setVoices] = useState<VoiceOption[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VOICES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load voices", e);
    }
    return INITIAL_VOICES;
  });

  // 2. History (Requires Date parsing)
  const [history, setHistory] = useState<GeneratedClip[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        return JSON.parse(saved, (key, value) => {
           if (key === 'createdAt') return new Date(value);
           return value;
        });
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
    return [];
  });

  // 3. Merged History (Requires Date parsing)
  const [mergedHistory, setMergedHistory] = useState<MergedClip[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MERGED);
      if (saved) {
        return JSON.parse(saved, (key, value) => {
           if (key === 'createdAt') return new Date(value);
           return value;
        });
      }
    } catch (e) {
      console.error("Failed to load merged history", e);
    }
    return [];
  });

  // 4. Config
  const [modelConfig, setModelConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to parse saved config from localStorage", e);
    }
    return DEFAULT_CONFIG;
  });

  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(voices[0]);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);
  
  // Audio Playback State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- PERSISTENCE EFFECTS ---

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(modelConfig));
  }, [modelConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICES, JSON.stringify(voices));
  }, [voices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MERGED, JSON.stringify(mergedHistory));
  }, [mergedHistory]);


  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Update playback rate whenever config changes or audio loads
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = modelConfig.speed;
    }
  }, [modelConfig.speed]);
  
  // Preview State
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  

  useEffect(() => {
    // Capture stream from audio element once mounted for visualization
    if (audioRef.current) {
      const audioEl = audioRef.current as any;
      // Cross-browser support for captureStream
      const captureFn = audioEl.captureStream || audioEl.mozCaptureStream;
      
      if (captureFn) {
        try {
          const stream = captureFn.call(audioEl);
          setAudioStream(stream);
        } catch (e) {
          console.warn("Audio capture not supported or failed:", e);
        }
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVoiceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format time helper (mm:ss)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // BLOCK SYSTEM LOGIC
  const updateBlock = (id: string, newText: string) => {
    // Check for double newline to auto-split
    if (newText.includes('\n\n')) {
        const splitContent = newText.split(/\n\s*\n/); // Split by empty lines
        
        // Filter out accidental empty splits if necessary, but keep structure
        const validSegments = splitContent; 

        if (validSegments.length > 1) {
            setBlocks(prev => {
                const index = prev.findIndex(b => b.id === id);
                if (index === -1) return prev;

                const newBlocks = validSegments.map((segment, i) => ({
                    id: i === 0 ? id : `split-${Date.now()}-${i}`,
                    text: segment
                }));

                const before = prev.slice(0, index);
                const after = prev.slice(index + 1);
                
                return [...before, ...newBlocks, ...after];
            });
            return;
        }
    }

    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text: newText } : b));
  };

  const addBlock = (index?: number) => {
    const newBlock = { id: `block-${Date.now()}`, text: '' };
    if (index === undefined) {
        setBlocks(prev => [...prev, newBlock]);
    } else {
        setBlocks(prev => [
            ...prev.slice(0, index + 1),
            newBlock,
            ...prev.slice(index + 1)
        ]);
    }
  };

  const removeBlock = (id: string) => {
    if (blocks.length === 1) {
        setBlocks([{ id: `block-${Date.now()}`, text: '' }]); // Reset to empty instead of removing last
        return;
    }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const clearAllBlocks = () => {
      setBlocks([{ id: `init-${Date.now()}`, text: '' }]);
  };

  const getTotalCharCount = () => {
      return blocks.reduce((acc, curr) => acc + curr.text.length, 0);
  };

  const getFullText = () => {
      return blocks.map(b => b.text).filter(t => t.trim()).join('\n\n');
  };

  // -------------------------

  const handleSaveVoice = (newVoice: VoiceOption) => {
      setVoices(prev => [...prev, newVoice]);
      setSelectedVoice(newVoice);
      setCurrentView('tts'); // Redirect back to studio
      alert(`Voz "${newVoice.name}" criada com sucesso e pronta para uso!`);
  };

  const handleDeleteVoice = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta voz personalizada?')) {
      setVoices((prev) => prev.filter((v) => v.id !== voiceId));
      if (selectedVoice.id === voiceId) {
        setSelectedVoice(INITIAL_VOICES[0]);
      }
    }
  };

  const handleSaveMergedClip = (mergedClip: MergedClip) => {
      setMergedHistory(prev => [mergedClip, ...prev]);
  };

  const handleDeleteMergedClip = (id: string) => {
      if(confirm("Tem certeza que deseja excluir esta edição?")) {
        setMergedHistory(prev => prev.filter(c => c.id !== id));
      }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Handlers
  const handleGenerate = async () => {
    const fullText = getFullText();
    if (!fullText.trim()) return;
    if (!process.env.API_KEY) {
      alert("API Key não encontrada! Configure a variável API_KEY no seu provedor.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let response;

      // Logic Branch: Custom Voice (Multimodal Prompting) vs Standard TTS (Pre-built Voice)
      if (selectedVoice.isCustom && selectedVoice.base64Audio) {
         // USE MULTIMODAL MODEL to mimic the audio style
         // Model: gemini-2.5-flash which supports audio-in and audio-out
         response = await ai.models.generateContent({
             model: "gemini-2.5-flash", 
             contents: [
                 {
                     parts: [
                        {
                            inlineData: {
                                mimeType: "audio/wav",
                                data: selectedVoice.base64Audio
                            }
                        },
                        {
                            text: `Please read the following text exactly as written. Mimic the voice, tone, pace, and speaking style of the provided audio sample as closely as possible. Output only the speech audio, no introductory text.\n\nText to read: "${fullText}"`
                        }
                     ]
                 }
             ],
             config: {
                 responseModalities: [Modality.AUDIO],
                 temperature: modelConfig.temperature,
                 topP: modelConfig.topP,
                 topK: modelConfig.topK,
             }
         });
      } else {
         // USE STANDARD TTS MODEL
         response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: fullText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              temperature: modelConfig.temperature,
              topP: modelConfig.topP,
              topK: modelConfig.topK,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice.id },
                },
              },
            },
         });
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        // Convert base64 PCM to WAV Blob
        const pcmBuffer = base64ToArrayBuffer(base64Audio);
        const wavBlob = createWavBlob(pcmBuffer, 24000); // Gemini output defaults
        const audioUrl = URL.createObjectURL(wavBlob);

        const newClip: GeneratedClip = {
          id: Date.now().toString(),
          text: fullText,
          voiceName: selectedVoice.name,
          audioUrl: audioUrl,
          createdAt: new Date(),
        };

        setHistory(prev => [newClip, ...prev]);
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("Falha ao gerar o áudio. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const playClip = (clip: GeneratedClip) => {
    // Stop preview if playing
    setPreviewVoiceId(null);
    setIsPreviewLoading(false);

    if (audioRef.current) {
      if (playingClipId === clip.id) {
        audioRef.current.pause();
        setPlayingClipId(null);
      } else {
        audioRef.current.src = clip.audioUrl;
        audioRef.current.playbackRate = modelConfig.speed; // Apply speed
        audioRef.current.play()
          .catch(e => console.error("Playback failed", e));
        setPlayingClipId(clip.id);
      }
    }
  };

  const handleDownload = async (clip: GeneratedClip) => {
      try {
          setDownloadingClipId(clip.id);
          
          // Process the audio to burn in the speed setting
          const processedBlob = await processAudioBlob(clip.audioUrl, modelConfig.speed);
          const processedUrl = URL.createObjectURL(processedBlob);
          
          // Trigger download
          const a = document.createElement('a');
          a.href = processedUrl;
          a.download = `gemini_voice_${clip.id}_${modelConfig.speed}x.wav`;
          document.body.appendChild(a);
          a.click();
          
          // Cleanup
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(processedUrl), 100);
      } catch (e) {
          console.error("Download processing failed", e);
          alert("Erro ao processar download.");
      } finally {
          setDownloadingClipId(null);
      }
  };

  const handlePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation(); // Prevent selecting the voice when clicking preview

    if (!process.env.API_KEY) {
         alert("API Key não encontrada.");
         return;
    }

    // Toggle off if already playing this voice
    if (previewVoiceId === voice.id && !isPreviewLoading) {
        if (audioRef.current?.paused) {
             audioRef.current.play();
        } else {
             audioRef.current?.pause();
        }
        return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingClipId(null);
    
    setPreviewVoiceId(voice.id);
    setIsPreviewLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Portuguese preview text
      const previewText = `Olá, eu sou a voz ${voice.name}. Testando o áudio em português.`;
      
      let response;

      if (voice.isCustom && voice.base64Audio) {
           // Custom Voice Preview Logic
           response = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: [
                 {
                     parts: [
                        {
                            inlineData: {
                                mimeType: "audio/wav",
                                data: voice.base64Audio
                            }
                        },
                        {
                            text: `Say the following text, mimicking the audio style provided: "${previewText}"`
                        }
                     ]
                 }
             ],
             config: {
                 responseModalities: [Modality.AUDIO],
                 temperature: modelConfig.temperature,
                 topP: modelConfig.topP,
                 topK: modelConfig.topK,
             }
           });
      } else {
           // Standard Voice Preview Logic
           response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: previewText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              temperature: modelConfig.temperature,
              topP: modelConfig.topP,
              topK: modelConfig.topK,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice.id },
                },
              },
            },
          });
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        const pcmBuffer = base64ToArrayBuffer(base64Audio);
        const wavBlob = createWavBlob(pcmBuffer, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.playbackRate = modelConfig.speed; // Apply speed
          await audioRef.current.play();
        }
      } else {
        setPreviewVoiceId(null);
      }
    } catch (error) {
      console.error("Preview failed", error);
      setPreviewVoiceId(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleAudioLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    setDuration(e.currentTarget.duration);
    // Ensure speed is applied when metadata loads
    e.currentTarget.playbackRate = modelConfig.speed;
  };

  const handleAudioEnded = () => {
    setPlayingClipId(null);
    // Don't nullify previewVoiceId immediately so the slider stays visible at the end
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
      }
  };

  const deleteClip = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (playingClipId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingClipId(null);
    }
  };

  // Determine if a specific voice is currently playing or paused (active preview session)
  const isPreviewActive = (voiceId: string) => previewVoiceId === voiceId;
  const isAudioPlaying = (voiceId: string) => isPreviewActive(voiceId) && audioRef.current && !audioRef.current.paused;

  const fullText = getFullText();

  // LOADING SCREEN
  if (loadingSession) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // AUTH SCREEN
  if (!session) {
    return <Auth />;
  }

  // APP SCREEN
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 text-white mb-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <AudioWaveform className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">Gemini Studio</span>
        </div>
        
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Menu Principal</p>
          <nav className="space-y-1">
            <button 
              onClick={() => setCurrentView('tts')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${
                currentView === 'tts' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              <FileAudio className="w-5 h-5" />
              Texto para Voz
            </button>
            <button 
              onClick={() => setCurrentView('cloning')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${
                currentView === 'cloning' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              <Mic className="w-5 h-5" />
              Clonagem de Voz
            </button>
            <button 
              onClick={() => setCurrentView('editor')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${
                currentView === 'editor' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              <Scissors className="w-5 h-5" />
              Edição de Áudio
            </button>
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-800 space-y-3">
           <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-xs font-medium text-slate-300 truncate w-32">{session.user.email}</span>
             </div>
             <p className="text-[10px] text-slate-500">v1.5.0 • Editor Suite</p>
           </div>
           
           <button 
             onClick={handleLogout}
             className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 py-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-wide"
           >
             <LogOut className="w-4 h-4" />
             Sair
           </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <h1 className="text-xl font-bold text-slate-800">
            {currentView === 'tts' && 'Texto para Voz'}
            {currentView === 'cloning' && 'Clonagem de Voz'}
            {currentView === 'editor' && 'Edição de Áudio'}
          </h1>
          <div className="flex items-center gap-4">
             <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                Powered by Gemini 2.5
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          
          {currentView === 'editor' ? (
              <AudioEditor 
                sourceClips={history}
                mergedHistory={mergedHistory}
                onSaveMerged={handleSaveMergedClip}
                onDeleteMerged={handleDeleteMergedClip}
              />
          ) : currentView === 'cloning' ? (
             <div className="p-6">
                <VoiceCloning onSaveVoice={handleSaveVoice} />
             </div>
          ) : (
             <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
            
            {/* Left Column: Blocks Input */}
            <div className="xl:col-span-7 flex flex-col gap-6">

              {/* Scripts Blocks Container */}
              <div className="bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-800 flex-1 flex flex-col relative overflow-hidden min-h-[500px]">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center backdrop-blur-sm z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Roteiro (Blocos)</span>
                    <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded-full">{blocks.length} blocos</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{getTotalCharCount()} caracteres</span>
                </div>

                {/* Blocks Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-900">
                    {blocks.map((block, index) => (
                        <div key={block.id} className="group relative flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Line Number / Handle */}
                            <div className="pt-4 flex flex-col items-center gap-2">
                                <span className="text-xs font-mono text-slate-600 w-6 text-center select-none">{index + 1}</span>
                                <div className="hidden group-hover:flex flex-col gap-1 items-center">
                                    <div className="w-0.5 h-full bg-slate-800"></div>
                                </div>
                            </div>
                            
                            {/* Block Input */}
                            <div className="flex-1 relative">
                                <textarea
                                    value={block.text}
                                    onChange={(e) => updateBlock(block.id, e.target.value)}
                                    placeholder={`Bloco ${index + 1}: Digite ou cole seu texto aqui...`}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 focus:border-indigo-500/50 rounded-xl p-4 text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all text-base leading-relaxed min-h-[100px]"
                                    style={{
                                        // Simple auto-grow hack
                                        height: 'auto', 
                                        minHeight: '100px'
                                    }}
                                />
                                
                                {/* Block Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button 
                                        onClick={() => removeBlock(block.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Remover bloco"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Add Button (Between blocks) */}
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => addBlock(index)}
                                        className="bg-slate-700 text-slate-300 hover:bg-indigo-600 hover:text-white p-1 rounded-full shadow-sm border border-slate-600 transition-all transform hover:scale-110"
                                        title="Inserir novo bloco abaixo"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {/* Add Block Button at bottom */}
                    <button 
                        onClick={() => addBlock()}
                        className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar Bloco de Texto
                    </button>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center z-20">
                  <button
                    onClick={clearAllBlocks}
                    disabled={getTotalCharCount() === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed group"
                  >
                    <Eraser className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                    <span className="group-hover:text-red-400 transition-colors">Limpar Tudo</span>
                  </button>

                  <button
                    onClick={handleGenerate}
                    disabled={!fullText.trim() || isGenerating}
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
                      !fullText.trim() || isGenerating
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 border border-indigo-500'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        <span>Gerar Áudio Completo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Voice Selection, Settings & History */}
            <div className="xl:col-span-5 flex flex-col gap-6 h-[calc(100vh-8rem)] sticky top-6">
              
              {/* Voice Selector - Dropdown Style */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-shrink-0 relative z-20">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5" />
                  Selecione a Voz
                </label>

                <div className="relative" ref={dropdownRef}>
                    {/* Dropdown Trigger */}
                    <button
                        onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                        className="w-full flex items-center justify-between bg-white border border-slate-300 hover:border-indigo-500 rounded-xl p-3 shadow-sm transition-all text-left outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                        <div className="flex items-center gap-3">
                             {/* Mini Thumb (Avatar) */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                selectedVoice.isCustom 
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                : selectedVoice.gender === 'Male' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-pink-500 to-rose-500'
                            }`}>
                                {selectedVoice.isCustom ? <Mic className="w-5 h-5" /> : selectedVoice.name[0]}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                  {selectedVoice.name}
                                  {selectedVoice.isCustom && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 rounded-full border border-indigo-200">Custom</span>}
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-xs">{selectedVoice.description}</div>
                            </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isVoiceDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isVoiceDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[360px] overflow-y-auto custom-scrollbar z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {voices.map((voice) => (
                                <div
                                    key={voice.id}
                                    onClick={() => {
                                        setSelectedVoice(voice);
                                        setIsVoiceDropdownOpen(false);
                                    }}
                                    className={`flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${selectedVoice.id === voice.id ? 'bg-indigo-50/60' : ''}`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                         {/* Mini Thumb with Visualizer */}
                                        <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden ${
                                          voice.isCustom
                                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                          : voice.gender === 'Male' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-pink-500 to-rose-500'
                                        }`}>
                                            {previewVoiceId === voice.id && audioStream && !audioRef.current?.paused ? (
                                                <AudioVisualizer 
                                                    isActive={true} 
                                                    stream={audioStream} 
                                                    barColor="#ffffff" 
                                                    width={36} 
                                                    height={36} 
                                                />
                                            ) : (
                                                voice.isCustom ? <Mic className="w-4 h-4" /> : voice.name[0]
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm ${selectedVoice.id === voice.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                    {voice.name}
                                                </span>
                                                {selectedVoice.id === voice.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                                {voice.isCustom && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200">CLONADA</span>}
                                            </div>
                                            
                                            {/* Preview Controls (Slider) or Description */}
                                            {isPreviewActive(voice.id) && !isPreviewLoading ? (
                                                <div 
                                                  className="flex items-center gap-2 mt-1 mr-2"
                                                  onClick={(e) => e.stopPropagation()} // Prevent selecting voice when using slider
                                                >
                                                  <input 
                                                    type="range"
                                                    min="0"
                                                    max={duration || 100}
                                                    value={currentTime}
                                                    onChange={handleSeek}
                                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                  />
                                                  <span className="text-[10px] font-mono text-indigo-600 min-w-[30px] text-right">
                                                    {formatTime(currentTime)}
                                                  </span>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-500 truncate">{voice.description}</div>
                                            )}
                                        </div>
                                    </div>

                                     {/* Actions: Play Preview & Delete (for custom) */}
                                     <div className="flex items-center gap-2 ml-3">
                                        <button
                                            onClick={(e) => handlePreview(e, voice)}
                                            className={`p-2 rounded-full transition-all flex-shrink-0 ${
                                            previewVoiceId === voice.id
                                                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-indigo-600'
                                            }`}
                                            title="Ouvir prévia"
                                        >
                                            {previewVoiceId === voice.id && isPreviewLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : isAudioPlaying(voice.id) ? (
                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                            ) : (
                                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                            )}
                                        </button>

                                        {voice.isCustom && (
                                            <button
                                                onClick={(e) => handleDeleteVoice(e, voice.id)}
                                                className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                                title="Excluir voz"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                     </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              {/* Model Settings Card (Moved here) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-slate-400" />
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Configurações de Geração
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600">Temperatura</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{modelConfig.temperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={modelConfig.temperature}
                      onChange={(e) => setModelConfig(prev => ({...prev, temperature: parseFloat(e.target.value)}))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                    />
                  </div>

                  {/* Top P */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600">Top P</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{modelConfig.topP.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={modelConfig.topP}
                      onChange={(e) => setModelConfig(prev => ({...prev, topP: parseFloat(e.target.value)}))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                    />
                  </div>

                  {/* Top K */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600">Top K</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{modelConfig.topK}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={modelConfig.topK}
                      onChange={(e) => setModelConfig(prev => ({...prev, topK: parseInt(e.target.value)}))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                    />
                  </div>

                  {/* Speed */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600">Velocidade</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{modelConfig.speed.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-slate-400" />
                        <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={modelConfig.speed}
                        onChange={(e) => setModelConfig(prev => ({...prev, speed: parseFloat(e.target.value)}))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                        />
                    </div>
                  </div>
                </div>
              </div>

              {/* History / Library - Fills remaining space */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 relative z-10">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5 flex-shrink-0">
                  <History className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Gerações</span>
                  <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">{history.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4 opacity-60">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                        <AudioWaveform className="w-10 h-10 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Sua biblioteca está vazia</p>
                        <p className="text-xs mt-1">Gere seu primeiro áudio para vê-lo aqui.</p>
                      </div>
                    </div>
                  ) : (
                    history.map((clip) => (
                      <div 
                        key={clip.id} 
                        className={`group p-4 rounded-xl border transition-all duration-200 ${
                          playingClipId === clip.id 
                            ? 'border-indigo-300 bg-indigo-50/30 shadow-sm' 
                            : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                           <div className="flex flex-col gap-1 w-full min-w-0">
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">
                                 {clip.voiceName}
                               </span>
                               <span className="text-[10px] text-slate-400">
                                 {clip.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                             </div>
                             <p className="text-sm text-slate-700 line-clamp-2 font-medium leading-relaxed" title={clip.text}>
                               "{clip.text}"
                             </p>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50 border-dashed">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => playClip(clip)}
                              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0 shadow-sm ${
                                playingClipId === clip.id
                                  ? 'bg-indigo-600 text-white shadow-indigo-200 ring-2 ring-indigo-100'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                            >
                              {playingClipId === clip.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                            </button>
                            
                            {/* Audio Visualizer - Only visible when playing and stream is available */}
                            <div className="h-8 flex-1 max-w-[120px]">
                            {playingClipId === clip.id && audioStream ? (
                                <AudioVisualizer 
                                  isActive={true} 
                                  stream={audioStream} 
                                  barColor="#4f46e5"
                                  width={120}
                                  height={40}
                                />
                            ) : (
                                // Static representation when not playing
                                <div className="h-full w-full flex items-center gap-0.5 opacity-20">
                                  {[...Array(12)].map((_, i) => (
                                      <div key={i} className="w-1.5 bg-slate-800 rounded-full" style={{height: `${30 + Math.random() * 60}%`}}></div>
                                  ))}
                                </div>
                            )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 pl-2">
                             <button
                               onClick={() => handleDownload(clip)}
                               disabled={downloadingClipId === clip.id}
                               className={`p-2 rounded-lg transition-colors ${
                                 downloadingClipId === clip.id 
                                   ? 'text-indigo-600 bg-indigo-50'
                                   : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                               }`}
                               title="Baixar com configurações atuais"
                             >
                               {downloadingClipId === clip.id ? (
                                   <Loader2 className="w-4 h-4 animate-spin" />
                               ) : (
                                   <Download className="w-4 h-4" />
                               )}
                             </button>
                             <button 
                               onClick={() => deleteClip(clip.id)}
                               className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                               title="Excluir"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
      
      {/* Hidden Audio Element for Playback */}
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        className="hidden" 
        crossOrigin="anonymous" 
      />
    </div>
  );
}