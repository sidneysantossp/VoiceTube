
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Play, Pause, Trash2, AlertCircle, CheckCircle2, Clock, ShieldCheck, Loader2, Sparkles, Save, RotateCcw, FileWarning } from 'lucide-react';
import { VoiceOption } from '../types';
import { blobToBase64, base64ToArrayBuffer, createWavBlob } from '../utils/audioUtils';
import { GoogleGenAI, Modality } from '@google/genai';
import { supabase } from '../lib/supabase';

interface VoiceCloningProps {
  onSaveVoice: (voice: VoiceOption) => void;
  apiKey: string;
}

export default function VoiceCloning({ onSaveVoice, apiKey }: VoiceCloningProps) {
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

  // New State for Intermediate Preview Step
  const [createdVoice, setCreatedVoice] = useState<VoiceOption | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl, testAudioUrl]);

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
    setCreatedVoice(null);
    setTestAudioUrl(null);
    setRecordingTime(0);
    setError(null);
    setIsPlaying(false);
    setConsentGiven(false);
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
      setError("Você deve autorizar o uso da sua voz para prosseguir.");
      return;
    }

    setIsProcessing(true);

    try {
        // TEMPORARY: Convert to Base64 for PREVIEW ONLY
        // We do NOT upload to Supabase yet, to save storage.
        // We only upload on "Salvar na Biblioteca"
        const base64Audio = await blobToBase64(audioBlob);

        const newVoice: VoiceOption = {
          id: `temp-${Date.now()}`,
          name: voiceName,
          description: 'Voz clonada personalizada (Preview)',
          gender: gender,
          isCustom: true,
          base64Audio: base64Audio // Kept for preview
        };

        setCreatedVoice(newVoice);
    } catch (e) {
        console.error("Error processing voice:", e);
        setError("Erro ao processar o áudio da voz.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleTestClone = async () => {
      if (!createdVoice || !createdVoice.base64Audio || !apiKey) {
          setError("Configuração inválida ou API Key faltante. Configure no menu superior.");
          return;
      }

      setIsTesting(true);
      if (testAudioRef.current) {
          testAudioRef.current.pause();
          setIsPlayingTest(false);
      }

      try {
          const ai = new GoogleGenAI({ apiKey: apiKey });
          const previewText = `Olá! Esta é uma demonstração da voz clonada de ${createdVoice.name}.`;

          const response = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: [
                 {
                     parts: [
                        {
                            inlineData: {
                                mimeType: "audio/wav",
                                data: createdVoice.base64Audio
                            }
                        },
                        {
                            text: `Mimic the speaker in the audio provided and say: "${previewText}". Output only the audio.`
                        }
                     ]
                 }
             ],
             config: {
                 responseModalities: [Modality.AUDIO],
                 temperature: 1, // High temperature for expressiveness in cloning
             }
           });

           const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
           if (base64Audio) {
               const pcmBuffer = base64ToArrayBuffer(base64Audio);
               const wavBlob = createWavBlob(pcmBuffer, 24000);
               const url = URL.createObjectURL(wavBlob);
               
               if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
               setTestAudioUrl(url);
               
               // Auto play
               setTimeout(() => {
                   if (testAudioRef.current) {
                       testAudioRef.current.src = url;
                       testAudioRef.current.play();
                       setIsPlayingTest(true);
                   }
               }, 100);
           }

      } catch (e) {
          console.error("Test failed", e);
          setError("Falha ao gerar preview da voz. Verifique a API Key.");
      } finally {
          setIsTesting(false);
      }
  };

  const handleFinalSave = async () => {
      if (!createdVoice || !audioBlob) return;
      
      setIsProcessing(true);
      try {
          // 1. Get User ID
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado.");

          // 2. Upload to Supabase Storage
          const fileName = `${user.id}/${Date.now()}_${createdVoice.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from('voice-samples')
              .upload(fileName, audioBlob, {
                  contentType: 'audio/wav',
                  upsert: true
              });

          if (uploadError) throw uploadError;

          // 3. Get Public URL
          const { data: { publicUrl } } = supabase.storage
              .from('voice-samples')
              .getPublicUrl(fileName);

          // 4. Save Metadata to Database
          const { data: dbData, error: dbError } = await supabase
              .from('custom_voices')
              .insert({
                  user_id: user.id,
                  name: createdVoice.name,
                  description: createdVoice.description,
                  gender: createdVoice.gender,
                  storage_path: fileName,
                  public_url: publicUrl,
                  // IMPORTANT: We do NOT save base64Audio to DB to keep it light
              })
              .select()
              .single();

          if (dbError) throw dbError;

          // 5. Notify Parent
          const finalVoice: VoiceOption = {
              id: dbData.id,
              name: dbData.name,
              description: dbData.description,
              gender: dbData.gender as 'Male' | 'Female',
              isCustom: true,
              public_url: publicUrl,
              storage_path: fileName
          };

          onSaveVoice(finalVoice);

      } catch (err: any) {
          console.error("Save Error:", err);
          setError("Erro ao salvar voz na nuvem: " + (err.message || err));
      } finally {
          setIsProcessing(false);
      }
  };

  const toggleTestPlayback = () => {
      if (testAudioRef.current) {
          if (isPlayingTest) {
              testAudioRef.current.pause();
          } else {
              testAudioRef.current.play();
          }
          setIsPlayingTest(!isPlayingTest);
      }
  };

  // SUCCESS / PREVIEW VIEW
  if (createdVoice) {
      return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
             <div className="bg-white rounded-2xl p-8 shadow-xl border border-indigo-100 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Modelo de Voz Pronto!</h2>
                <p className="text-slate-500 mb-8">
                    Sua voz <strong>{createdVoice.name}</strong> está pronta para ser salva na nuvem.
                </p>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Testar Clonagem</span>
                        {isTesting && <span className="text-xs text-indigo-500 animate-pulse">Gerando áudio...</span>}
                    </div>

                    <div className="flex items-center gap-4">
                         <button
                            onClick={testAudioUrl ? toggleTestPlayback : handleTestClone}
                            disabled={isTesting}
                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                isTesting 
                                ? 'bg-slate-200 text-slate-400 cursor-wait'
                                : testAudioUrl 
                                    ? isPlayingTest 
                                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-200'
                            }`}
                         >
                             {isTesting ? (
                                 <Loader2 className="w-5 h-5 animate-spin" />
                             ) : testAudioUrl ? (
                                 isPlayingTest ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />
                             ) : (
                                 <Sparkles className="w-5 h-5" />
                             )}
                             {testAudioUrl ? (isPlayingTest ? 'Pausar Preview' : 'Ouvir Preview') : 'Gerar Preview da Voz'}
                         </button>
                    </div>
                    {testAudioUrl && (
                        <p className="text-xs text-slate-400 mt-3 text-center italic">
                            "Olá! Esta é uma demonstração da voz clonada de {createdVoice.name}."
                        </p>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Descartar
                    </button>
                    <button
                        onClick={handleFinalSave}
                        disabled={isProcessing}
                        className={`flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 ${
                            isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isProcessing ? 'Salvando...' : 'Salvar na Biblioteca'}
                    </button>
                </div>

                <audio ref={testAudioRef} onEnded={() => setIsPlayingTest(false)} className="hidden" />
             </div>
        </div>
      );
  }

  // STANDARD VIEW (Record/Upload)
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

            <div className={`p-4 rounded-xl border transition-all ${consentGiven ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
               <label className="flex items-start gap-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={consentGiven}
                   onChange={(e) => setConsentGiven(e.target.checked)}
                   className="mt-1 w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                 />
                 <div className="text-sm leading-relaxed">
                   <div className="flex items-center gap-2 mb-1">
                        {consentGiven ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <FileWarning className="w-4 h-4 text-amber-600" />}
                        <span className={`font-bold ${consentGiven ? 'text-emerald-800' : 'text-amber-800'}`}>Consentimento de Uso Obrigatório</span>
                   </div>
                   <p className={`${consentGiven ? 'text-emerald-700' : 'text-amber-700'}`}>
                     Eu declaro que possuo os direitos sobre este áudio e autorizo explicitamente o uso desta voz para fins de clonagem e síntese de fala na plataforma.
                   </p>
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
                disabled={isProcessing || !consentGiven}
                className={`px-8 py-3.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all ${
                    isProcessing || !consentGiven
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200'
                }`}
                title={!consentGiven ? "Marque a caixa de consentimento para continuar" : ""}
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
