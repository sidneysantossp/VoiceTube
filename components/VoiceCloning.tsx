import React, { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Play, Pause, Trash2, AlertCircle, CheckCircle2, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { VoiceOption } from '../types';
import { blobToBase64 } from '../utils/audioUtils';

interface VoiceCloningProps {
  onSaveVoice: (voice: VoiceOption) => void;
}

export default function VoiceCloning({ onSaveVoice }: VoiceCloningProps) {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop()); // Stop mic
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError("Por favor, envie apenas arquivos de áudio.");
        return;
      }
      
      const url = URL.createObjectURL(file);
      setAudioBlob(file);
      setAudioUrl(url);
      
      // Load duration to validate
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setRecordingTime(Math.round(audio.duration));
      };
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setError(null);
    setIsPlaying(false);
  };

  const handleSubmit = async () => {
    // Validation
    if (!audioBlob) return;
    if (recordingTime < 20) {
      setError("A gravação deve ter no mínimo 20 segundos.");
      return;
    }
    if (recordingTime > 60) {
      setError("A gravação não deve exceder 60 segundos.");
      return;
    }
    if (!voiceName.trim()) {
      setError("Por favor, dê um nome à sua voz.");
      return;
    }
    if (!consentGiven) {
      setError("Você deve autorizar o uso da sua voz.");
      return;
    }

    setIsProcessing(true);

    try {
        // Convert Blob to Base64 to store in memory for usage
        const base64Audio = await blobToBase64(audioBlob);

        // Simulate API upload/processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        const newVoice: VoiceOption = {
          id: `custom-${Date.now()}`,
          name: voiceName,
          description: 'Voz clonada personalizada (Sintetizada)',
          gender: gender,
          isCustom: true,
          base64Audio: base64Audio
        };

        onSaveVoice(newVoice);
    } catch (e) {
        console.error("Error processing voice:", e);
        setError("Erro ao processar o áudio da voz.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-rose-100 p-2 rounded-lg">
            <Mic className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Clonagem de Voz Instantânea</h2>
            <p className="text-slate-500">Crie uma réplica digital da sua voz em segundos.</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-600 flex gap-3">
          <AlertCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-700 mb-1">Requisitos para uma boa clonagem:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Grave em um ambiente silencioso.</li>
              <li>Fale de forma clara e natural.</li>
              <li>Mínimo de 20 segundos, máximo de 60 segundos de áudio.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Input Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Record Option */}
        <button 
          onClick={() => setMode('record')}
          className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-4 ${
            mode === 'record' 
              ? 'border-indigo-600 bg-indigo-50/50' 
              : 'border-slate-200 hover:border-indigo-200 bg-white'
          }`}
        >
          <div className={`p-4 rounded-full ${mode === 'record' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <Mic className="w-8 h-8" />
          </div>
          <span className={`font-semibold ${mode === 'record' ? 'text-indigo-900' : 'text-slate-600'}`}>Gravar Microfone</span>
        </button>

        {/* Upload Option */}
        <button 
          onClick={() => setMode('upload')}
          className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-4 ${
            mode === 'upload' 
              ? 'border-indigo-600 bg-indigo-50/50' 
              : 'border-slate-200 hover:border-indigo-200 bg-white'
          }`}
        >
          <div className={`p-4 rounded-full ${mode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <Upload className="w-8 h-8" />
          </div>
          <span className={`font-semibold ${mode === 'upload' ? 'text-indigo-900' : 'text-slate-600'}`}>Enviar Arquivo</span>
        </button>
      </div>

      {/* Recorder / Uploader Area */}
      <div className="bg-slate-900 rounded-2xl p-8 text-center relative overflow-hidden shadow-xl">
        {!audioBlob ? (
          mode === 'record' ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                {isRecording && (
                  <span className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping"></span>
                )}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                    isRecording 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50' 
                      : 'bg-white text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {isRecording ? <div className="w-8 h-8 rounded bg-white" /> : <Mic className="w-10 h-10" />}
                </button>
              </div>
              
              <div className="space-y-2">
                <div className={`text-4xl font-mono font-bold tracking-wider ${isRecording ? 'text-rose-400' : 'text-slate-500'}`}>
                  00:{recordingTime.toString().padStart(2, '0')}
                </div>
                <p className="text-slate-400 text-sm">
                  {isRecording ? 'Gravando... Fale naturalmente.' : 'Clique para começar a gravar'}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-slate-800/50 transition-all group cursor-pointer relative">
               <input 
                 type="file" 
                 accept="audio/*" 
                 onChange={handleFileUpload}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
               <div className="flex flex-col items-center justify-center space-y-4">
                 <div className="p-4 bg-slate-800 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                   <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
                 </div>
                 <div>
                   <p className="text-lg font-medium text-slate-200">Arraste um áudio ou clique para selecionar</p>
                   <p className="text-sm text-slate-500 mt-1">MP3, WAV ou M4A (Max 10MB)</p>
                 </div>
               </div>
            </div>
          )
        ) : (
          /* Preview Area */
          <div className="py-8 w-full max-w-md mx-auto space-y-6">
            <div className="flex items-center justify-between mb-2">
               <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Preview do Áudio</span>
               <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  recordingTime >= 20 && recordingTime <= 60 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-amber-500/20 text-amber-400'
               }`}>
                  <Clock className="w-3 h-3" />
                  {recordingTime}s
               </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
              <button 
                onClick={togglePlayback}
                className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              <div className="flex-1 h-12 bg-slate-900 rounded-lg overflow-hidden flex items-center px-3 gap-0.5 opacity-50">
                 {/* Fake Waveform */}
                 {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-full bg-slate-600 rounded-full animate-pulse" style={{height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s`}}></div>
                 ))}
              </div>
            </div>

            <button 
              onClick={handleReset}
              className="text-sm text-rose-400 hover:text-rose-300 flex items-center gap-2 mx-auto transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Descartar e gravar novamente
            </button>
            
            <audio 
              ref={audioRef} 
              src={audioUrl || ''} 
              onEnded={() => setIsPlaying(false)} 
              className="hidden" 
            />
          </div>
        )}
      </div>

      {/* Footer Form */}
      {audioBlob && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Finalizar Clonagem</h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome da Voz</label>
                <input 
                    type="text" 
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="Ex: Minha Voz Profissional"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                />
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Gênero</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setGender('Male')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                gender === 'Male' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Masculino
                        </button>
                        <button
                            onClick={() => setGender('Female')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                gender === 'Female' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Feminino
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <label className="flex items-start gap-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={consentGiven}
                   onChange={(e) => setConsentGiven(e.target.checked)}
                   className="mt-1 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                 />
                 <div className="text-sm text-slate-600 leading-relaxed">
                   <span className="font-bold text-slate-800 block mb-1">Consentimento de Uso</span>
                   Eu confirmo que tenho os direitos necessários para clonar esta voz e autorizo a plataforma a processar este áudio para fins de síntese de fala.
                 </div>
               </label>
            </div>

            {error && (
               <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm flex items-center gap-2">
                 <AlertCircle className="w-4 h-4" />
                 {error}
               </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando IA...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Criar Voz Clonada
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}