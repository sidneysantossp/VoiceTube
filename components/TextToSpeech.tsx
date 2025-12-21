
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { VoiceOption, GeneratedClip, ScriptBlock, UserIntegrations } from '../types';
import { generateContentWithRetry } from '../utils/aiService';
import { createWavBlob, base64ToArrayBuffer, blobToBase64 } from '../utils/audioUtils';
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Plus, 
  X, 
  Wand2, 
  Loader2, 
  Search, 
  Mic, 
  Languages, 
  ChevronDown,
  Layers,
  History,
  Square,
  Filter,
  User,
  Bot
} from 'lucide-react';

interface TextToSpeechProps {
  apiKey: string;
  integrations?: UserIntegrations;
  voices: VoiceOption[];
  history: GeneratedClip[];
  setHistory: React.Dispatch<React.SetStateAction<GeneratedClip[]>>;
}

export default function TextToSpeech({ apiKey, integrations, voices, history, setHistory }: TextToSpeechProps) {
  // State
  const [blocks, setBlocks] = useState<ScriptBlock[]>([{ id: 'init-1', text: '' }]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(voices[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  
  // Playback State
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  
  // Preview State
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // UI State
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters State
  const [filterGender, setFilterGender] = useState<'All' | 'Male' | 'Female'>('All');
  const [filterType, setFilterType] = useState<'All' | 'Native' | 'Custom'>('All');

  // Update selected voice if voices list changes (e.g. loading custom voices)
  useEffect(() => {
    if (voices.length > 0 && !voices.find(v => v.id === selectedVoice.id)) {
      setSelectedVoice(voices[0]);
    }
  }, [voices]);

  // Handle Audio End Event to clean up all states
  const handleAudioEnded = () => {
      setPlayingClipId(null);
      setPreviewingVoiceId(null);
      setIsPreviewLoading(false);
  };

  // --- LOGIC ---

  const addBlock = (index?: number) => {
    const newBlock = { id: `block-${Date.now()}-${Math.random()}`, text: '' };
    setBlocks(prev => {
      if (index === undefined) return [...prev, newBlock];
      const newArr = [...prev];
      newArr.splice(index + 1, 0, newBlock);
      return newArr;
    });
  };

  const removeBlock = (id: string) => {
    if (blocks.length > 1) {
      setBlocks(prev => prev.filter(b => b.id !== id));
    } else {
      setBlocks([{ id: `init-${Date.now()}`, text: '' }]);
    }
  };

  const updateBlock = (id: string, text: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text } : b));
  };

  const getTotalCharCount = () => blocks.reduce((acc, b) => acc + b.text.length, 0);

  // --- API GENERATION ---

  const handleGenerate = async () => {
    const textToGenerate = blocks.map(b => b.text).filter(t => t.trim()).join('\n\n');
    if (!textToGenerate) {
      alert("Digite algum texto para gerar áudio.");
      return;
    }

    const activeKey = integrations?.gemini_key || apiKey;
    if (!activeKey) {
      alert("Chave de API não encontrada. Configure no menu Sistema.");
      return;
    }

    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      let audioData: string | undefined;

      if (selectedVoice.isCustom) {
        // --- CUSTOM VOICE CLONING FLOW ---
        // Uses Multimodal Prompting on standard Flash model
        
        let referenceAudioBase64 = selectedVoice.base64Audio;
        
        // If we only have a URL (from DB), fetch it and convert to base64
        if (!referenceAudioBase64 && selectedVoice.public_url) {
            try {
                const resp = await fetch(selectedVoice.public_url);
                const blob = await resp.blob();
                referenceAudioBase64 = await blobToBase64(blob);
            } catch (e) {
                console.error("Failed to fetch custom voice audio", e);
                throw new Error("Erro ao baixar áudio de referência da voz clonada.");
            }
        }

        if (!referenceAudioBase64) {
            throw new Error("Dados de áudio da voz personalizada não encontrados.");
        }

        const response = await generateContentWithRetry({
          apiKey: activeKey,
          model: "gemini-2.5-flash", // Use standard flash for multimodal
          contents: [
            {
              parts: [
                { 
                    inlineData: { 
                        mimeType: "audio/wav", 
                        data: referenceAudioBase64 
                    } 
                },
                { 
                    text: `Please read the following text with the same voice, tone, and style as the audio provided. Text to read: "${textToGenerate}". Output ONLY the raw audio.` 
                }
              ]
            }
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            temperature: 1 // Higher temp helps with style transfer in cloning
          }
        });
        
        audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      } else {
        // --- STANDARD TTS FLOW ---
        // Uses dedicated TTS model
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: textToGenerate }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: selectedVoice.id 
                        }
                    }
                }
            }
        });
        audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }

      if (!audioData) throw new Error("A IA não retornou áudio.");

      // Decode and Process
      const pcmBuffer = base64ToArrayBuffer(audioData);
      
      // Create WAV (Standard Gemini TTS is 24kHz)
      // Custom voice cloning via Flash might differ, but 24kHz is a safe container default usually
      const wavBlob = createWavBlob(pcmBuffer, 24000); 
      const audioUrl = URL.createObjectURL(wavBlob);

      // Add to History
      const newClip: GeneratedClip = {
        id: `clip-${Date.now()}`,
        text: textToGenerate.substring(0, 60) + (textToGenerate.length > 60 ? '...' : ''),
        voiceName: selectedVoice.name,
        audioUrl: audioUrl,
        createdAt: new Date(),
        duration: 0 // Duration will be calculated on load if needed, or update logic later
      };

      setHistory(prev => [newClip, ...prev]);

    } catch (error: any) {
      console.error(error);
      alert(`Erro na geração: ${error.message || error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- VOICE PREVIEW ---

  const handleVoicePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
      e.stopPropagation(); // Don't select the voice, just play
      
      const activeKey = integrations?.gemini_key || apiKey;
      
      // If clicking same voice that is playing, stop it
      if (previewingVoiceId === voice.id) {
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
          }
          setPreviewingVoiceId(null);
          setIsPreviewLoading(false);
          return;
      }

      // Stop any other playback
      if (audioRef.current) {
          audioRef.current.pause();
          setPlayingClipId(null);
      }

      setIsPreviewLoading(true);
      setPreviewingVoiceId(voice.id);

      try {
          let previewUrl = '';

          if (voice.isCustom) {
              // Custom Voice: Use the reference audio directly
              if (voice.base64Audio) {
                  // FIX: Use utils to convert instead of fetch data uri (avoids Failed to fetch on large strings)
                  try {
                      const buffer = base64ToArrayBuffer(voice.base64Audio);
                      const blob = new Blob([buffer], { type: 'audio/wav' });
                      previewUrl = URL.createObjectURL(blob);
                  } catch (err) {
                      console.error("Buffer conversion error:", err);
                      // Fallback
                      const res = await fetch(`data:audio/wav;base64,${voice.base64Audio}`);
                      const blob = await res.blob();
                      previewUrl = URL.createObjectURL(blob);
                  }
              } else if (voice.public_url) {
                  previewUrl = voice.public_url;
              } else {
                  throw new Error("Áudio de referência não disponível");
              }
          } else {
              // Native Voice: Generate a quick sample
              if (!activeKey) throw new Error("API Key necessária para preview");
              
              const ai = new GoogleGenAI({ apiKey: activeKey });
              const text = `Olá, eu sou ${voice.name}. Esta é uma demonstração da minha voz.`;
              
              const response = await generateContentWithRetry({
                  apiKey: activeKey,
                  model: "gemini-2.5-flash-preview-tts",
                  contents: [{ parts: [{ text }] }],
                  config: {
                      responseModalities: [Modality.AUDIO],
                      speechConfig: {
                          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.id } }
                      }
                  }
              });
              
              const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (!audioData) throw new Error("Sem áudio");
              
              const pcmBuffer = base64ToArrayBuffer(audioData);
              const wavBlob = createWavBlob(pcmBuffer, 24000);
              previewUrl = URL.createObjectURL(wavBlob);
          }

          if (audioRef.current) {
              audioRef.current.src = previewUrl;
              audioRef.current.play().catch(e => {
                  console.error("Play error:", e);
                  alert("Erro ao reproduzir áudio. Formato não suportado.");
              });
          }

          setIsPreviewLoading(false);

      } catch (e: any) {
          console.error("Preview failed:", e);
          setIsPreviewLoading(false);
          setPreviewingVoiceId(null);
          alert(e.message || "Erro ao reproduzir preview da voz.");
      }
  };


  // --- AUDIO PLAYBACK ---

  const togglePlay = (url: string, id: string) => {
    if (audioRef.current) {
      if (playingClipId === id && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingClipId(null);
      } else {
        // Stop preview if playing
        setPreviewingVoiceId(null);
        
        audioRef.current.src = url;
        audioRef.current.play().catch(e => console.error("Playback error", e));
        setPlayingClipId(id);
      }
    }
  };

  const deleteClip = (id: string) => {
    setHistory(prev => prev.filter(c => c.id !== id));
    if (playingClipId === id && audioRef.current) {
        audioRef.current.pause();
        setPlayingClipId(null);
    }
  };

  // Enhanced Filter Logic
  const filteredVoices = voices.filter(v => {
    const search = searchTerm.toLowerCase();
    
    // Text Filter
    const matchesText = 
        v.name.toLowerCase().includes(search) || 
        v.description.toLowerCase().includes(search);

    // Gender Filter
    const matchesGender = filterGender === 'All' || v.gender === filterGender;

    // Type Filter
    const isNative = !v.isCustom;
    const isCustom = !!v.isCustom;
    const matchesType = filterType === 'All' || 
                        (filterType === 'Native' && isNative) || 
                        (filterType === 'Custom' && isCustom);
    
    return matchesText && matchesGender && matchesType;
  });

  return (
    <div className="flex h-full bg-slate-50">
      
      {/* LEFT: Editor */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
         
         {/* Toolbar */}
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 z-20">
            
            {/* Voice Selector */}
            <div className="relative w-full md:w-72">
                <button 
                    onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                    className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:border-indigo-300 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedVoice.gender === 'Female' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                            {selectedVoice.name.charAt(0)}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-700">{selectedVoice.name}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                {selectedVoice.isCustom && <Mic className="w-3 h-3 text-indigo-500" />}
                                {selectedVoice.isCustom ? 'Clonada' : 'Nativa'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {isVoiceDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-96 overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95">
                        
                        {/* Search Bar */}
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input 
                                    autoFocus
                                    placeholder="Buscar..." 
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Filters Toolbar */}
                        <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                            {/* Gender Filters */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Gênero:</span>
                                {['All', 'Male', 'Female'].map((g) => (
                                    <button
                                        key={g}
                                        onClick={() => setFilterGender(g as any)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors whitespace-nowrap ${
                                            filterGender === g 
                                            ? 'bg-indigo-600 text-white border-indigo-600' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        {g === 'All' ? 'Todos' : g === 'Male' ? 'Masculino' : 'Feminino'}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Type Filters */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Tipo:</span>
                                {['All', 'Native', 'Custom'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setFilterType(t as any)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors whitespace-nowrap ${
                                            filterType === t 
                                            ? 'bg-indigo-600 text-white border-indigo-600' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        {t === 'All' ? 'Todas' : t === 'Native' ? 'Nativa (Gemini)' : 'Clonada'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                            {filteredVoices.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center">
                                    <Filter className="w-8 h-8 mb-2 opacity-20" />
                                    <p>Nenhuma voz encontrada com estes filtros.</p>
                                    <button 
                                        onClick={() => { setFilterGender('All'); setFilterType('All'); setSearchTerm(''); }}
                                        className="mt-2 text-indigo-600 hover:underline"
                                    >
                                        Limpar filtros
                                    </button>
                                </div>
                            ) : (
                                filteredVoices.map(voice => (
                                    <div
                                        key={voice.id}
                                        onClick={() => { setSelectedVoice(voice); setIsVoiceDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer group ${selectedVoice.id === voice.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${voice.gender === 'Female' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {voice.name.charAt(0)}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-700">{voice.name}</span>
                                                <div className="flex gap-1">
                                                    {voice.isCustom && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">PRO</span>}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 truncate">{voice.description}</p>
                                        </div>
                                        
                                        {/* Preview Button */}
                                        <button
                                            onClick={(e) => handleVoicePreview(e, voice)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 border ${
                                                previewingVoiceId === voice.id 
                                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                                : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-300'
                                            }`}
                                            title="Ouvir amostra"
                                        >
                                            {previewingVoiceId === voice.id ? (
                                                isPreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                                            )}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Speed & Generate */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className="flex flex-col w-32">
                     <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold uppercase">
                         <span>Velocidade</span>
                         <span>{speed}x</span>
                     </div>
                     <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.1" 
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        className="h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                     />
                 </div>

                 <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                        isGenerating 
                        ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-200 transform hover:-translate-y-0.5'
                    }`}
                 >
                     {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                     {isGenerating ? 'Gerando...' : 'Gerar Áudio'}
                 </button>
            </div>
         </div>

         {/* Blocks Editor */}
         <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
             {blocks.map((block, index) => (
                 <div key={block.id} className="relative group animate-in slide-in-from-bottom-2 fade-in">
                     <div className="absolute -left-3 top-6 w-3 h-px bg-slate-300 hidden md:block"></div>
                     <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 group-focus-within:border-indigo-400 group-focus-within:ring-4 group-focus-within:ring-indigo-50 transition-all relative">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bloco {index + 1}</span>
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => removeBlock(block.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remover bloco">
                                     <Trash2 className="w-4 h-4" />
                                 </button>
                             </div>
                         </div>
                         <textarea
                            value={block.text}
                            onChange={(e) => updateBlock(block.id, e.target.value)}
                            placeholder="Digite seu texto aqui..."
                            className="w-full min-h-[100px] resize-none outline-none text-slate-700 leading-relaxed bg-transparent"
                         />
                         
                         {/* Insert Button (Bottom) */}
                         <button 
                            onClick={() => addBlock(index)}
                            className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
                            title="Adicionar novo bloco abaixo"
                         >
                             <Plus className="w-5 h-5" />
                         </button>
                     </div>
                 </div>
             ))}
             
             {/* Bottom Add Button */}
             <div className="py-4 flex justify-center">
                 <button 
                    onClick={() => addBlock()}
                    className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors"
                 >
                     <Plus className="w-4 h-4" /> Adicionar Bloco
                 </button>
             </div>
             
             <div className="h-10"></div> {/* Spacer */}
         </div>

         <div className="mt-4 flex justify-between items-center text-xs text-slate-400 font-medium px-2">
             <span>{blocks.length} blocos</span>
             <span>{getTotalCharCount()} caracteres</span>
         </div>
      </div>

      {/* RIGHT: History Sidebar */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col hidden xl:flex z-10 shadow-xl">
         <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
             <History className="w-4 h-4 text-indigo-500" />
             <h3 className="font-bold text-slate-700">Histórico de Geração</h3>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {history.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                     <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
                     <p className="text-sm">Nenhum áudio gerado ainda.</p>
                 </div>
             ) : (
                 history.map(clip => (
                     <div key={clip.id} className="bg-white border border-slate-100 rounded-xl p-3 hover:border-indigo-200 hover:shadow-md transition-all group">
                         <div className="flex justify-between items-start mb-2">
                             <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                                 {clip.voiceName}
                             </span>
                             <span className="text-[10px] text-slate-400">
                                 {new Date(clip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                         </div>
                         <p className="text-xs text-slate-600 line-clamp-2 mb-3 italic">
                             "{clip.text}"
                         </p>
                         <div className="flex items-center gap-1">
                             <button 
                                onClick={() => togglePlay(clip.audioUrl, clip.id)}
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-bold transition-colors gap-1 ${playingClipId === clip.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                             >
                                 {playingClipId === clip.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                 {playingClipId === clip.id ? 'Pausar' : 'Ouvir'}
                             </button>
                             <button 
                                onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = clip.audioUrl;
                                    a.download = `voice_tube_${clip.id}.wav`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                             >
                                 <Download className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => deleteClip(clip.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                             >
                                 <Trash2 className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                 ))
             )}
         </div>
      </div>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  );
}
