import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, SystemSetting } from '../types';
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
  Check,
  Edit3,
  Trash2,
  X,
  UserCog,
  MoreHorizontal
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<{
    full_name: string;
    role: 'user' | 'admin';
    is_banned: boolean;
  }>({ full_name: '', role: 'user', is_banned: false });

  // API Key Testing State
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const formatError = (e: any) => {
      if (typeof e === 'string') return e;
      if (e?.message) return e.message;
      return JSON.stringify(e);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setUsers(data as UserProfile[]);
      } else {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .order('key');
        
        // Handle explicit "relation does not exist" error gracefully
        if (error && error.code === '42P01') {
             setSettings([]); // Empty settings implies table missing
        } else if (error) {
             throw error;
        } else {
             setSettings(data as SystemSetting[]);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD ACTIONS ---

  const handleEditClick = (user: UserProfile) => {
      setEditingUser(user);
      setFormData({
          full_name: user.full_name || '',
          role: user.role || 'user',
          is_banned: user.is_banned || false
      });
      setIsEditModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação removerá o perfil e não pode ser desfeita.")) {
          return;
      }

      try {
          const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('id', userId);

          if (error) throw error;

          setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err) {
          alert(`Erro ao excluir usuário: ${formatError(err)}`);
      }
  };

  const handleUpdateUser = async () => {
      if (!editingUser) return;

      setSaving(true);
      try {
          const { error } = await supabase
              .from('profiles')
              .update({
                  full_name: formData.full_name,
                  role: formData.role,
                  is_banned: formData.is_banned
              })
              .eq('id', editingUser.id);

          if (error) throw error;

          // Update local state
          setUsers(prev => prev.map(u => 
              u.id === editingUser.id 
              ? { ...u, ...formData } 
              : u
          ));
          
          setIsEditModalOpen(false);
          setEditingUser(null);
      } catch (err) {
          alert(`Erro ao atualizar usuário: ${formatError(err)}`);
      } finally {
          setSaving(false);
      }
  };

  // --------------------

  const handleSettingChange = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
    if (key === 'gemini_api_key') {
      setKeyTestStatus('idle');
    }
  };

  const handleTestConnection = async (apiKey: string) => {
    if (!apiKey.trim()) {
      alert("Por favor, insira uma chave para testar.");
      return;
    }

    setTestingKey(true);
    setKeyTestStatus('idle');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: "Hello" }] }],
      });

      if (response && response.text) {
        setKeyTestStatus('success');
      } else {
        throw new Error("Resposta vazia da API");
      }
    } catch (error) {
      console.error("API Key Test Failed:", error);
      setKeyTestStatus('error');
    } finally {
      setTestingKey(false);
    }
  };

  const saveSettings = async () => {
    setError(null);
    const geminiSetting = settings.find(s => s.key === 'gemini_api_key');
    if (geminiSetting) {
      const key = geminiSetting.value.trim();
      if (!key) {
        alert("A Chave API do Gemini não pode ficar vazia.");
        return;
      }
    }

    setSaving(true);
    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: setting.value })
          .eq('key', setting.key);
        if (error) throw error;
      }
      alert("Configurações salvas com sucesso!");
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar: ${formatError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto relative">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              Painel Administrativo
            </h1>
            <p className="text-slate-500 mt-1">Gerenciamento global da plataforma Voice Tube</p>
          </div>
          
          <button 
             onClick={fetchData} 
             className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
             Atualizar Dados
          </button>
        </div>

        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold text-sm">Ocorreu um erro</p>
                    <p className="text-xs font-mono mt-1 opacity-90">{error}</p>
                </div>
            </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-4 font-medium text-sm flex items-center gap-2 transition-colors relative ${
              activeTab === 'users' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários
            {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 px-4 font-medium text-sm flex items-center gap-2 transition-colors relative ${
              activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Key className="w-4 h-4" />
            Chaves de API & Sistema
            {activeTab === 'settings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Search */}
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar usuário por email ou nome..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-xs text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Permissão</th>
                    <th className="px-6 py-4">Data Cadastro</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{user.full_name || 'Sem nome'}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_banned ? (
                          <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded-full w-fit text-xs font-bold">
                            <Ban className="w-3 h-3" /> Banido
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit text-xs font-bold">
                            <CheckCircle className="w-3 h-3" /> Ativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => handleEditClick(user)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar Usuário"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            
                            {/* Prohibit deleting yourself */}
                            {user.email !== 'sid.websp@gmail.com' && (
                                <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Excluir Usuário"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl animate-in fade-in">
             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3 text-amber-800 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>
                  As chaves configuradas aqui serão usadas <strong>Globalmente</strong> para todos os usuários.
                </p>
             </div>

             <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {settings.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p>Nenhuma configuração encontrada.</p>
                    <p className="text-xs mt-2 text-indigo-500">Se o banco foi resetado, rode o script de sincronização novamente.</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {settings.map((setting) => (
                      <div key={setting.key}>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {setting.description || setting.key}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    value={setting.value}
                                    onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                    className={`w-full bg-slate-50 border rounded-lg p-3 pr-10 font-mono text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none ${
                                        setting.key === 'gemini_api_key' && keyTestStatus === 'error' 
                                        ? 'border-red-300 bg-red-50' 
                                        : setting.key === 'gemini_api_key' && keyTestStatus === 'success'
                                            ? 'border-emerald-300 bg-emerald-50'
                                            : 'border-slate-300'
                                    }`}
                                    placeholder="Insira o valor da chave..."
                                />
                                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                            
                            {/* Gemini API Test Button */}
                            {setting.key === 'gemini_api_key' && (
                                <button
                                    onClick={() => handleTestConnection(setting.value)}
                                    disabled={testingKey || !setting.value}
                                    className={`px-4 rounded-lg font-bold text-sm transition-all flex items-center gap-2 border ${
                                        keyTestStatus === 'success' 
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                        : keyTestStatus === 'error'
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
                                    }`}
                                >
                                    {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    Testar
                                </button>
                            )}
                        </div>
                      </div>
                    ))}

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-70"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Configurações
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                              <UserCog className="w-5 h-5" />
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-800">Editar Usuário</h3>
                              <p className="text-xs text-slate-500">{editingUser.email}</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="p-6 space-y-5">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                          <input 
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Nome do usuário"
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Permissão (Role)</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setFormData({...formData, role: 'user'})}
                                className={`p-3 rounded-xl border font-medium text-sm transition-all ${
                                    formData.role === 'user' 
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                  Membro (User)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({...formData, role: 'admin'})}
                                className={`p-3 rounded-xl border font-medium text-sm transition-all ${
                                    formData.role === 'admin' 
                                    ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' 
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                  Administrador
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Status de Acesso</label>
                          <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50">
                              <button
                                type="button"
                                onClick={() => setFormData({...formData, is_banned: !formData.is_banned})}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    !formData.is_banned ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      !formData.is_banned ? 'translate-x-6' : 'translate-x-1'
                                  }`} />
                              </button>
                              <span className={`text-sm font-bold ${!formData.is_banned ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {formData.is_banned ? 'Acesso Banido' : 'Acesso Ativo'}
                              </span>
                          </div>
                      </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                      <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={handleUpdateUser}
                        disabled={saving}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-70"
                      >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar Alterações
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}