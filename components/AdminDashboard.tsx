import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, SystemSetting } from '../types';
import { 
  Shield, 
  Users, 
  Key, 
  Search, 
  Ban, 
  CheckCircle, 
  Save, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';

interface AdminDashboardProps {
  isDemo?: boolean;
}

export default function AdminDashboard({ isDemo = false }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isDemo) {
      loadMockData();
    } else {
      fetchData();
    }
  }, [activeTab, isDemo]);

  const loadMockData = () => {
    setLoading(true);
    setTimeout(() => {
      if (activeTab === 'users') {
        setUsers([
          {
            id: 'demo-user-123',
            email: 'demo@voicetube.com',
            full_name: 'Admin Demo',
            role: 'admin',
            is_banned: false,
            created_at: new Date().toISOString()
          },
          {
            id: 'user-456',
            email: 'user@example.com',
            full_name: 'John Doe',
            role: 'user',
            is_banned: false,
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'user-789',
            email: 'spammer@fake.com',
            full_name: 'Spam Bot',
            role: 'user',
            is_banned: true,
            created_at: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
      } else {
        setSettings([
          {
            key: 'gemini_api_key',
            value: 'AIzaSy... (Mock Key)',
            description: 'Chave Global do Google Gemini (Sobrescreve .env)'
          },
          {
            key: 'maintenance_mode',
            value: 'false',
            description: 'Modo de Manutenção'
          }
        ]);
      }
      setLoading(false);
    }, 500);
  };

  const fetchData = async () => {
    setLoading(true);
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
        
        if (error) throw error;
        setSettings(data as SystemSetting[]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados do admin:", error);
      alert(`Erro ao carregar dados: ${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserBan = async (userId: string, currentStatus: boolean) => {
    if (isDemo) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentStatus } : u));
        return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentStatus } : u));
    } catch (error: any) {
      alert(`Erro ao atualizar status do usuário: ${error.message}`);
    }
  };

  const handleSettingChange = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  const saveSettings = async () => {
    setSaving(true);
    if (isDemo) {
        setTimeout(() => {
            setSaving(false);
            alert("Configurações salvas (Modo Demo)!");
        }, 800);
        return;
    }

    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: setting.value })
          .eq('key', setting.key);
        if (error) throw error;
      }
      alert("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao salvar configurações: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              Painel Administrativo
              {isDemo && <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded-full border border-amber-200">Modo Demo</span>}
            </h1>
            <p className="text-slate-500 mt-1">Gerenciamento global da plataforma Voice Tube</p>
          </div>
        </div>

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
                placeholder="Buscar usuário por email..." 
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
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Data Cadastro</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {user.email}
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{user.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
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
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => toggleUserBan(user.id, user.is_banned || false)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.is_banned 
                              ? 'text-emerald-600 hover:bg-emerald-50' 
                              : 'text-red-500 hover:bg-red-50'
                            }`}
                            title={user.is_banned ? "Reativar acesso" : "Banir usuário"}
                          >
                            {user.is_banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl animate-in fade-in">
             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3 text-amber-800 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>
                  As chaves configuradas aqui serão usadas <strong>Globalmente</strong> para todos os usuários da plataforma, sobrescrevendo as chaves locais ou de ambiente.
                  Cuidado ao editar.
                </p>
             </div>

             <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {settings.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p>Nenhuma configuração de sistema encontrada no banco de dados.</p>
                    <p className="text-xs mt-2">Rode o script SQL de admin para inicializar a tabela `system_settings`.</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {settings.map((setting) => (
                      <div key={setting.key}>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          {setting.description || setting.key}
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={setting.value}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 pr-10 font-mono text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Insira o valor da chave..."
                          />
                          <Key className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
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
    </div>
  );
}