
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
  LogOut,
  BookOpen,
  ShieldCheck,
  KeyRound,
  User,
  LayoutDashboard,
  Menu,
  Info,
  Cpu,
  LayoutTemplate,
  Users,
  LayoutGrid,
  Shield,
  ArrowLeft,
  Key
} from 'lucide-react';
import { INITIAL_VOICES, VoiceOption, GeneratedClip, ScriptBlock, MergedClip, UserProfile, UserIntegrations, PlatformModules, DEFAULT_MODULES } from './types';
import { createWavBlob, base64ToArrayBuffer, processAudioBlob, blobToBase64 } from './utils/audioUtils';
import { generateContentWithRetry } from './utils/aiService';
import AudioVisualizer from './components/AudioVisualizer';
import VoiceCloning from './components/VoiceCloning';
import AudioEditor from './components/AudioEditor';
import ScriptCreator from './components/ScriptCreator';
import AdminDashboard from './components/AdminDashboard';
import UserProfilePage from './components/UserProfilePage';
import SettingsPage from './components/SettingsPage';
import TitleCreator from './components/TitleCreator';
import TextToSpeech from './components/TextToSpeech';

const env = (import.meta as any).env || {};

const DEFAULT_CONFIG = {
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  speed: 1.0
};

const DEFAULT_INTEGRATIONS: UserIntegrations = {
  gemini_key: '',
  openai_key: '',
  anthropic_key: '',
  xai_key: '',
  perplexity_key: '',
  preferred_script_model: 'gemini',
  preferred_image_model: 'gemini'
};

const STORAGE_KEYS = {
  CONFIG: 'gemini_voice_model_config',
  HISTORY: 'gemini_voice_history_clips',
  MERGED: 'gemini_voice_merged_clips',
  LOCAL_API_KEY: 'gemini_voice_user_api_key',
  INTEGRATIONS: 'voice_tube_integrations_v1'
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [apiKey, setApiKey] = useState<string>('');
  const [isGlobalKey, setIsGlobalKey] = useState(false);
  const [enabledModules, setEnabledModules] = useState<PlatformModules>(DEFAULT_MODULES);

  const [integrations, setIntegrations] = useState<UserIntegrations>(() => {
      try {
          const saved = localStorage.getItem(STORAGE_KEYS.INTEGRATIONS);
          return saved ? { ...DEFAULT_INTEGRATIONS, ...JSON.parse(saved) } : DEFAULT_INTEGRATIONS;
      } catch (e) {
          return DEFAULT_INTEGRATIONS;
      }
  });

  useEffect(() => {
      localStorage.setItem(STORAGE_KEYS.INTEGRATIONS, JSON.stringify(integrations));
      if (integrations.gemini_key && !isGlobalKey) {
          setApiKey(integrations.gemini_key);
      }
  }, [integrations, isGlobalKey]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        setLoadingSession(true);
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
            setSession(session);
            fetchUserProfile(session);
        }
        setLoadingSession(false);
      })
      .catch((err) => {
        console.warn("Supabase session check failed:", err);
        setLoadingSession(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          fetchUserProfile(session);
      } else {
          setUserProfile(null);
      }
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (currentSession: any) => {
      if (!currentSession?.user?.id) return;
      
      const uid = currentSession.user.id;
      const email = currentSession.user.email;

      try {
          // 1. Get Profile
          const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', uid)
              .single();
          
          if (email === 'sid.websp@gmail.com') {
             setUserProfile({
                id: uid,
                email: email,
                full_name: profile?.full_name || 'Admin Principal',
                avatar_url: profile?.avatar_url,
                role: 'admin',
                created_at: profile?.created_at || new Date().toISOString()
             });
          }
          else if (profile) {
              setUserProfile(profile as UserProfile);
          } 
          else {
              setUserProfile({
                  id: uid,
                  email: email,
                  role: 'user',
                  created_at: new Date().toISOString()
              });
          }

          // 2. Fetch Global Settings & Modules
          const { data: settings } = await supabase
            .from('system_settings')
            .select('*');

          if (settings) {
              const globalKey = settings.find(s => s.key === 'gemini_api_key');
              if (globalKey?.value) {
                  setApiKey(globalKey.value);
                  setIsGlobalKey(true);
                  setIntegrations(prev => ({ ...prev, gemini_key: globalKey.value }));
              }

              const modulesConfig = settings.find(s => s.key === 'platform_modules');
              if (modulesConfig?.value) {
                  try {
                      setEnabledModules(JSON.parse(modulesConfig.value));
                  } catch (e) {
                      console.warn("Error parsing modules config", e);
                  }
              }
          }

      } catch (e) {
          console.warn("Error fetching profile/settings:", e);
      }
  };

  const updateIntegrations = (newSettings: UserIntegrations) => {
      setIntegrations(newSettings);
      if (!isGlobalKey) {
          setApiKey(newSettings.gemini_key);
      }
  };

  // Navigation State
  const [currentView, setCurrentView] = useState<'tts' | 'cloning' | 'editor' | 'script-creator' | 'title-creator' | 'admin' | 'profile' | 'settings'>('title-creator');
  // Sub-navigation for Admin Dashboard
  const [adminView, setAdminView] = useState<'overview' | 'users' | 'modules' | 'settings'>('overview');
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scriptInitialData, setScriptInitialData] = useState<{ premise: string } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [blocks, setBlocks] = useState<ScriptBlock[]>([{ id: 'init-1', text: '' }]);
  const [voices, setVoices] = useState<VoiceOption[]>(INITIAL_VOICES);

  // Load Custom Voices
  useEffect(() => {
      if (session?.user?.id) {
          const fetchCustomVoices = async () => {
              const { data } = await supabase.from('custom_voices').select('*').eq('user_id', session.user.id);
              if (data) {
                  const customVoices: VoiceOption[] = data.map(v => ({
                      id: v.id, name: v.name, description: v.description || 'Voz Personalizada', gender: v.gender || 'Male', isCustom: true, public_url: v.public_url, storage_path: v.storage_path
                  }));
                  setVoices([...INITIAL_VOICES, ...customVoices]);
              }
          };
          fetchCustomVoices();
      }
  }, [session]);

  const [history, setHistory] = useState<GeneratedClip[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]', (k, v) => k === 'createdAt' ? new Date(v) : v); } catch { return []; }
  });
  const [mergedHistory, setMergedHistory] = useState<MergedClip[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MERGED) || '[]', (k, v) => k === 'createdAt' ? new Date(v) : v); } catch { return []; }
  });
  const [modelConfig, setModelConfig] = useState(() => {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}') }; } catch { return DEFAULT_CONFIG; }
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(modelConfig)); }, [modelConfig]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MERGED, JSON.stringify(mergedHistory)); }, [mergedHistory]);
  
  const handleNavClick = (view: typeof currentView) => {
      setCurrentView(view);
      setIsMobileMenuOpen(false);
  };

  const handleAdminNav = (view: typeof adminView) => {
      setAdminView(view);
      setIsMobileMenuOpen(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); 
    setUserProfile(null);
  };

  if (loadingSession) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!session) return <Auth />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center gap-3 text-white mb-2 justify-between lg:justify-start">
          <div className="flex items-center gap-3">
              <div className={`${currentView === 'admin' ? 'bg-indigo-600' : 'bg-indigo-600'} p-2 rounded-lg shadow-lg`}>
                {currentView === 'admin' ? <Shield className="w-6 h-6" /> : <AudioWaveform className="w-6 h-6" />}
              </div>
              <span className="font-bold text-xl tracking-tight">
                  {currentView === 'admin' ? 'Admin Panel' : 'Voice Tube'}
              </span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="px-4 py-2 flex-1 flex flex-col overflow-y-auto">
          
          {/* DYNAMIC SIDEBAR CONTENT */}
          {currentView === 'admin' ? (
              // ADMIN SIDEBAR
              <div className="space-y-6 animate-in slide-in-from-left-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Gestão</p>
                    <nav className="space-y-1">
                        <button onClick={() => handleAdminNav('overview')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${adminView === 'overview' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                            <LayoutDashboard className="w-5 h-5" /> Visão Geral
                        </button>
                        <button onClick={() => handleAdminNav('users')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${adminView === 'users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                            <Users className="w-5 h-5" /> Usuários
                        </button>
                        <button onClick={() => handleAdminNav('modules')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${adminView === 'modules' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                            <LayoutGrid className="w-5 h-5" /> Módulos
                        </button>
                        <button onClick={() => handleAdminNav('settings')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${adminView === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                            <Key className="w-5 h-5" /> Chaves API
                        </button>
                    </nav>
                  </div>
                  <div>
                      <button onClick={() => handleNavClick('title-creator')} className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
                          <ArrowLeft className="w-4 h-4" /> Voltar ao App
                      </button>
                  </div>
              </div>
          ) : (
              // APP SIDEBAR
              <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Criação</p>
                    <nav className="space-y-1">
                        {enabledModules.title_creator && (
                            <button onClick={() => handleNavClick('title-creator')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'title-creator' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <LayoutTemplate className="w-5 h-5" /> Criador de Títulos
                            </button>
                        )}
                        {enabledModules.script_creator && (
                            <button onClick={() => handleNavClick('script-creator')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'script-creator' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <BookOpen className="w-5 h-5" /> Criador de Roteiro
                            </button>
                        )}
                    </nav>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Áudio Studio</p>
                    <nav className="space-y-1">
                        {enabledModules.tts && (
                            <button onClick={() => handleNavClick('tts')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'tts' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <FileAudio className="w-5 h-5" /> Texto para Voz
                            </button>
                        )}
                        {enabledModules.editor && (
                            <button onClick={() => handleNavClick('editor')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'editor' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <Scissors className="w-5 h-5" /> Edição de Áudio
                            </button>
                        )}
                        {enabledModules.cloning && (
                            <button onClick={() => handleNavClick('cloning')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'cloning' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <Mic className="w-5 h-5" /> Clonagem de Voz
                            </button>
                        )}
                    </nav>
                  </div>

                  <div className="mt-auto">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Sistema</p>
                    <nav className="space-y-1">
                        <button onClick={() => handleNavClick('settings')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left font-medium transition-all ${currentView === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                            <Cpu className="w-5 h-5" /> Configurações
                        </button>
                    </nav>
                  </div>
              </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800">
           <div className="text-[10px] text-slate-600 text-center">
                &copy; 2024 Voice Tube - v2.0 Admin
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full transition-all duration-300">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-30 relative shadow-sm lg:shadow-none">
          <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg lg:text-xl font-bold text-slate-800 truncate">
                  {currentView === 'admin' ? (
                      <span className="flex items-center gap-2 text-indigo-600"><Shield className="w-5 h-5"/> Admin: {adminView.charAt(0).toUpperCase() + adminView.slice(1)}</span>
                  ) : (
                      currentView === 'title-creator' ? 'Criador de Títulos (SEO)' :
                      currentView === 'script-creator' ? 'Criador de Roteiro (AI)' :
                      currentView === 'tts' ? 'Texto para Voz' :
                      currentView === 'editor' ? 'Edição de Áudio' : 'Configurações'
                  )}
              </h1>
          </div>
          
          <div className="flex items-center gap-4">
               {/* User Menu */}
               <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 lg:gap-3 hover:bg-slate-50 p-1.5 rounded-lg">
                        <div className="text-right hidden md:block">
                            <p className="text-xs font-bold text-slate-700">{userProfile?.full_name || 'Usuário'}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{userProfile?.role}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5 text-slate-500" />}
                        </div>
                    </button>
                    
                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                            <button onClick={() => { setCurrentView('profile'); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex gap-2"><User className="w-4 h-4" /> Perfil</button>
                            {userProfile?.role === 'admin' && (
                                <button onClick={() => { setCurrentView('admin'); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-indigo-600 font-bold flex gap-2 border-t border-slate-100"><Shield className="w-4 h-4" /> Painel Admin</button>
                            )}
                            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex gap-2 border-t border-slate-100"><LogOut className="w-4 h-4" /> Sair</button>
                        </div>
                    )}
               </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50">
           {currentView === 'admin' ? (
               <AdminDashboard activeView={adminView} />
           ) : currentView === 'settings' ? (
               <SettingsPage integrations={integrations} onUpdateIntegrations={updateIntegrations} />
           ) : currentView === 'title-creator' ? (
               <TitleCreator apiKey={apiKey} integrations={integrations} />
           ) : currentView === 'script-creator' ? (
               <ScriptCreator apiKey={apiKey} integrations={integrations} onExportScript={() => {}} />
           ) : currentView === 'tts' ? (
               <TextToSpeech 
                   apiKey={apiKey} 
                   integrations={integrations} 
                   voices={voices} 
                   history={history}
                   setHistory={setHistory}
               />
           ) : currentView === 'editor' ? (
               <AudioEditor sourceClips={history} mergedHistory={mergedHistory} onSaveMerged={() => {}} onDeleteMerged={() => {}} />
           ) : currentView === 'cloning' ? (
               <div className="p-6"><VoiceCloning onSaveVoice={() => {}} apiKey={apiKey} /></div>
           ) : (
               <div className="p-8 text-center text-slate-400">Selecione uma ferramenta no menu.</div>
           )}
        </main>
      </div>
    </div>
  );
}
