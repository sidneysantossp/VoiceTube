
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, SystemSetting, PlatformModules, DEFAULT_MODULES } from '../types';
import { GoogleGenAI } from '@google/genai';
import { 
  Shield, 
  Users, 
  Key, 
  Search, 
  Ban, 
  CheckCircle, 
  Save, 
  Loader2, 
  AlertTriangle,
  Zap,
  XCircle,
  Edit3,
  Trash2,
  X,
  UserCog,
  LayoutGrid,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Mail,
  Calendar,
  Fingerprint,
  Link as LinkIcon,
  Image,
  Upload,
  CloudUpload
} from 'lucide-react';

interface AdminDashboardProps {
  activeView: 'overview' | 'users' | 'modules' | 'settings';
}

export default function AdminDashboard({ activeView }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [modules, setModules] = useState<PlatformModules>(DEFAULT_MODULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // User View State: List or Edit Page
  const [userViewState, setUserViewState] = useState<'list' | 'edit'>('list');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  // Avatar Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Expanded Form Data
  const [formData, setFormData] = useState<{
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    role: 'user' | 'admin';
    is_banned: boolean;
    created_at: string;
  }>({ 
    id: '',
    email: '',
    full_name: '',
    avatar_url: '',
    role: 'user', 
    is_banned: false,
    created_at: ''
  });

  // API Key Testing State
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchData();
    setUserViewState('list'); // Reset to list when changing main tabs
  }, [activeView]);

  const formatError = (e: any) => {
      if (typeof e === 'string') return e;
      if (e?.message) return e.message;
      return JSON.stringify(e);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeView === 'users') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setUsers(data as UserProfile[]);
      } 
      else if (activeView === 'settings') {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .order('key');
        
        if (error && error.code !== '42P01') throw error;
        setSettings(data as SystemSetting[] || []);
      }
      else if (activeView === 'modules') {
          const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'platform_modules')
            .single();
          
          if (data?.value) {
              try {
                  setModules(JSON.parse(data.value));
              } catch (e) {
                  setModules(DEFAULT_MODULES);
              }
          }
      }
      else if (activeView === 'overview') {
          // Fetch basic stats
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          // Mocking other stats for now as they require more complex queries
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- USERS ---

  const handleEditClick = (user: UserProfile) => {
      setEditingUser(user);
      setFormData({
          id: user.id,
          email: user.email,
          full_name: user.full_name || '',
          avatar_url: user.avatar_url || '',
          role: user.role || 'user',
          is_banned: user.is_banned || false,
          created_at: user.created_at
      });
      setUserViewState('edit');
      setIsUploading(false);
  };

  const handleCancelEdit = () => {
      setUserViewState('list');
      setEditingUser(null);
      setIsUploading(false);
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("Tem certeza? Esta ação é irreversível e apagará todos os dados do usuário.")) return;
      try {
          // Note: Supabase might restrict deletion if linked to Auth, 
          // usually you delete from auth.users via server-side admin client.
          // Here we try deleting the profile.
          const { error } = await supabase.from('profiles').delete().eq('id', userId);
          if (error) throw error;
          setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err) {
          alert(`Erro: ${formatError(err)}`);
      }
  };

  const handleUpdateUser = async () => {
      if (!editingUser) return;
      setSaving(true);
      try {
          const updates = {
              full_name: formData.full_name,
              role: formData.role,
              is_banned: formData.is_banned,
              avatar_url: formData.avatar_url
          };

          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', editingUser.id)
            .select();
            
          if (error) throw error;
          
          if (!data || data.length === 0) {
              throw new Error("Nenhum registro foi atualizado. Verifique se você tem permissão de administrador (RLS).");
          }
          
          setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
          setUserViewState('list');
          alert("Usuário atualizado com sucesso!");
      } catch (err) {
          alert(`Erro ao salvar: ${formatError(err)}`);
      } finally {
          setSaving(false);
      }
  };

  const handleAvatarFile = async (file: File) => {
      if (!editingUser) return;
      
      try {
          setIsUploading(true);
          const fileExt = file.name.split('.').pop();
          const fileName = `${editingUser.id}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          // Upload with upsert
          const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, file, { upsert: true });

          if (uploadError) throw uploadError;

          // Get URL
          const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);

          setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      } catch (e: any) {
          console.error("Upload failed:", e);
          alert("Erro ao fazer upload da imagem: " + (e.message || e));
      } finally {
          setIsUploading(false);
          setIsDragging(false);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
              await handleAvatarFile(file);
          } else {
              alert("Por favor, solte apenas arquivos de imagem.");
          }
      }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          await handleAvatarFile(e.target.files[0]);
      }
      // Reset input value to allow re-selection of same file
      if (e.target) e.target.value = '';
  };

  // --- MODULES ---
  const toggleModule = (key: keyof PlatformModules) => {
      setModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveModules = async () => {
      setSaving(true);
      try {
          const { error } = await supabase
            .from('system_settings')
            .upsert({ 
                key: 'platform_modules', 
                value: JSON.stringify(modules),
                description: 'Configuration for enabled platform features'
            });
            
          if (error) throw error;
          alert("Módulos atualizados com sucesso!");
      } catch (e) {
          alert("Erro ao salvar módulos.");
      } finally {
          setSaving(false);
      }
  };

  // --- SETTINGS ---
  const handleSettingChange = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      for (const setting of settings) {
        await supabase.from('system_settings').update({ value: setting.value }).eq('key', setting.key);
      }
      alert("Configurações salvas!");
    } catch (err) {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // RENDER: OVERVIEW
  if (activeView === 'overview') {
      return (
          <div className="p-8 animate-in fade-in">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Visão Geral do Sistema</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                              <Users className="w-8 h-8" />
                          </div>
                          <div>
                              <p className="text-sm text-slate-500 font-bold uppercase">Usuários Totais</p>
                              <p className="text-3xl font-bold text-slate-800">{users.length > 0 ? users.length : '--'}</p>
                          </div>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                              <Zap className="w-8 h-8" />
                          </div>
                          <div>
                              <p className="text-sm text-slate-500 font-bold uppercase">Status da API</p>
                              <p className="text-xl font-bold text-emerald-600">Online</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // RENDER: MODULES
  if (activeView === 'modules') {
      return (
          <div className="p-8 animate-in fade-in max-w-4xl">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestão de Módulos</h2>
                    <p className="text-slate-500">Ative ou desative funcionalidades para todos os usuários.</p>
                 </div>
                 <button 
                    onClick={saveModules}
                    disabled={saving}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors flex items-center gap-2"
                 >
                     {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                     Salvar Alterações
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {[
                      { key: 'title_creator', label: 'Criador de Títulos (SEO)', desc: 'Gerador de ideias e metadados.' },
                      { key: 'script_creator', label: 'Criador de Roteiros', desc: 'Assistente de escrita com IA.' },
                      { key: 'tts', label: 'Texto para Voz (TTS)', desc: 'Conversão de texto em áudio.' },
                      { key: 'editor', label: 'Edição de Áudio', desc: 'Timeline multitrack.' },
                      { key: 'cloning', label: 'Clonagem de Voz', desc: 'Recurso de clonagem instantânea.' },
                  ].map((mod) => (
                      <div key={mod.key} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                              <h3 className="font-bold text-slate-800 text-lg">{mod.label}</h3>
                              <p className="text-slate-500">{mod.desc}</p>
                          </div>
                          <button 
                             onClick={() => toggleModule(mod.key as keyof PlatformModules)}
                             className={`p-1 rounded-full transition-colors ${modules[mod.key as keyof PlatformModules] ? 'text-emerald-500' : 'text-slate-300'}`}
                          >
                              {modules[mod.key as keyof PlatformModules] 
                                ? <ToggleRight className="w-12 h-12 fill-emerald-100" /> 
                                : <ToggleLeft className="w-12 h-12" />
                              }
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // RENDER: SETTINGS
  if (activeView === 'settings') {
      return (
          <div className="p-8 animate-in fade-in max-w-3xl">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Configurações Globais</h2>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                {settings.map((setting) => (
                    <div key={setting.key}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        {setting.description || setting.key}
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={setting.value}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    </div>
                ))}
                <div className="flex justify-end pt-4">
                    <button onClick={saveSettings} disabled={saving} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-500">
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
              </div>
          </div>
      );
  }

  // RENDER: USERS (List or Edit)
  if (userViewState === 'edit') {
      return (
          <div className="p-8 animate-in slide-in-from-right-4 max-w-5xl mx-auto">
              <button 
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-6 transition-colors"
              >
                  <ArrowLeft className="w-4 h-4" /> Voltar para lista
              </button>

              <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold text-slate-800">Editar Usuário</h2>
                  <div className="flex gap-3">
                      <button 
                          onClick={handleCancelEdit}
                          className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleUpdateUser}
                          disabled={saving}
                          className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 flex items-center gap-2 shadow-lg shadow-indigo-200"
                      >
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                          Salvar Alterações
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column: Avatar & ID */}
                  <div className="space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                          <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden mb-4 flex items-center justify-center relative">
                              {formData.avatar_url ? (
                                  <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                  <Users className="w-12 h-12 text-slate-300" />
                              )}
                              {isUploading && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                                  </div>
                              )}
                          </div>
                          <div className="text-center w-full">
                              <h3 className="font-bold text-lg text-slate-800">{formData.full_name || 'Usuário'}</h3>
                              <p className="text-slate-500 text-sm">{formData.email}</p>
                          </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Metadados</h4>
                          <div className="space-y-4">
                              <div>
                                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                                      <Fingerprint className="w-4 h-4" />
                                      <span className="text-xs font-bold">User ID</span>
                                  </div>
                                  <code className="block bg-slate-100 p-2 rounded text-xs text-slate-600 font-mono break-all border border-slate-200">
                                      {formData.id}
                                  </code>
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                                      <Calendar className="w-4 h-4" />
                                      <span className="text-xs font-bold">Data de Criação</span>
                                  </div>
                                  <p className="text-sm text-slate-700 pl-1">
                                      {new Date(formData.created_at).toLocaleString()}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Form */}
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              <div className="col-span-2">
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                                  <div className="relative">
                                      <Users className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                      <input 
                                          value={formData.full_name} 
                                          onChange={e => setFormData({...formData, full_name: e.target.value})} 
                                          className="w-full pl-10 p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                          placeholder="Nome do usuário" 
                                      />
                                  </div>
                              </div>

                              <div className="col-span-2">
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Email (Apenas Leitura)</label>
                                  <div className="relative">
                                      <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                      <input 
                                          value={formData.email} 
                                          disabled
                                          className="w-full pl-10 p-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed" 
                                      />
                                  </div>
                              </div>

                              <div className="col-span-2">
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Avatar URL</label>
                                  <div className="relative">
                                      <Image className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                      <input 
                                          value={formData.avatar_url} 
                                          onChange={e => setFormData({...formData, avatar_url: e.target.value})} 
                                          className="w-full pl-10 p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                          placeholder="https://..." 
                                      />
                                  </div>
                                  
                                  {/* Drag and Drop Area */}
                                  <div 
                                      onDragOver={handleDragOver}
                                      onDragLeave={handleDragLeave}
                                      onDrop={handleDrop}
                                      onClick={() => fileInputRef.current?.click()}
                                      className={`mt-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                          isDragging 
                                          ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' 
                                          : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                      }`}
                                  >
                                      <input 
                                          type="file" 
                                          ref={fileInputRef} 
                                          onChange={handleFileInputChange} 
                                          accept="image/*" 
                                          className="hidden" 
                                      />
                                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                          {isUploading ? (
                                              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                          ) : (
                                              <CloudUpload className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
                                          )}
                                          <p className="text-sm font-medium">
                                              {isUploading 
                                                  ? "Enviando imagem..." 
                                                  : isDragging 
                                                      ? "Solte a imagem aqui" 
                                                      : "Clique ou arraste uma imagem"
                                              }
                                          </p>
                                          {!isUploading && (
                                              <p className="text-xs text-slate-400">JPG, PNG, WebP</p>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Permissão (Role)</label>
                                  <select 
                                      value={formData.role} 
                                      onChange={e => setFormData({...formData, role: e.target.value as any})} 
                                      className="w-full p-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                      <option value="user">Usuário Comum</option>
                                      <option value="admin">Administrador</option>
                                  </select>
                              </div>

                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Status da Conta</label>
                                  <div className={`p-3 rounded-xl border flex items-center justify-between ${formData.is_banned ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                      <span className={`text-sm font-bold ${formData.is_banned ? 'text-red-700' : 'text-emerald-700'}`}>
                                          {formData.is_banned ? 'Banido' : 'Ativo'}
                                      </span>
                                      <button 
                                          onClick={() => setFormData(prev => ({ ...prev, is_banned: !prev.is_banned }))}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_banned ? 'bg-red-500' : 'bg-emerald-500'}`}
                                      >
                                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_banned ? 'translate-x-6' : 'translate-x-1'}`} />
                                      </button>
                                  </div>
                              </div>

                          </div>
                      </div>

                      <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                          <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-5 h-5" /> Zona de Perigo
                          </h4>
                          <p className="text-sm text-red-600 mb-4">
                              A exclusão de um usuário é permanente e removerá todos os dados associados.
                          </p>
                          <button 
                              onClick={() => handleDeleteUser(formData.id)}
                              className="px-4 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors"
                          >
                              Excluir Usuário Permanentemente
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // DEFAULT: USERS LIST
  return (
    <div className="p-8 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gestão de Usuários</h2>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
              />
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-xs text-slate-500">
                    <tr>
                        <th className="px-6 py-4">Usuário</th>
                        <th className="px-6 py-4">Permissão</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-900">{user.full_name || 'Sem nome'}</div>
                                <div className="text-xs text-slate-500">{user.email}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {user.is_banned ? (
                                    <span className="text-red-700 font-bold text-xs bg-red-50 px-2 py-1 rounded border border-red-100 flex items-center gap-1 w-fit">
                                        <Ban className="w-3 h-3" /> BANIDO
                                    </span>
                                ) : (
                                    <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 w-fit">
                                        <CheckCircle className="w-3 h-3" /> ATIVO
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleEditClick(user)} 
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                    Nenhum usuário encontrado.
                </div>
            )}
        </div>
    </div>
  );
}
