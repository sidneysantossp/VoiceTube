import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  User, 
  Mail, 
  Camera, 
  Save, 
  Loader2, 
  Shield, 
  CreditCard, 
  Calendar,
  LogOut,
  Upload
} from 'lucide-react';

interface UserProfilePageProps {
  user: any; // Supabase auth user
  profile: UserProfile | null;
  onProfileUpdate: () => void;
}

export default function UserProfilePage({ user, profile, onProfileUpdate }: UserProfilePageProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar Upload Handler
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      setIsUploading(true);
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Profile in DB
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onProfileUpdate(); // Refresh parent state
      alert('Foto de perfil atualizada!');

    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  // Profile Update Handler
  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      
      onProfileUpdate();
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.reload();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações da Conta</h1>
          <p className="text-slate-500 mt-2">Gerencie suas informações pessoais e assinatura.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Avatar & Basic Info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100 relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Loading Overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2 right-2 bg-indigo-600 text-white p-2 rounded-full shadow-md border-2 border-white group-hover:bg-indigo-500 transition-colors">
                    <Upload className="w-4 h-4" />
                </div>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarUpload}
              />

              <h2 className="mt-4 text-xl font-bold text-slate-800">{fullName || 'Usuário Sem Nome'}</h2>
              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded mt-1">
                {user.email}
              </span>
              
              <div className="mt-4 flex gap-2">
                 <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                    profile?.role === 'admin' 
                    ? 'bg-purple-50 text-purple-700 border-purple-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                 }`}>
                    {profile?.role === 'admin' ? 'Administrador' : 'Plano Gratuito'}
                 </span>
              </div>
            </div>

            {/* Quick Stats (Placeholder for SaaS) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 text-sm mb-4 uppercase tracking-wider">Estatísticas de Uso</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Créditos de IA</span>
                            <span className="font-bold text-indigo-600">Ilimitado (Beta)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full w-[20%]"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Armazenamento</span>
                            <span className="font-bold text-slate-700">12% usado</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full w-[12%]"></div>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Right Column: Edit Forms */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Personal Info Form */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <User className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Informações Pessoais</h3>
                    <p className="text-slate-500 text-sm">Atualize seus dados de identificação</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                        <input 
                            type="text" 
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Seu nome"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="email" 
                                value={user.email}
                                disabled
                                className="w-full pl-10 p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSaveProfile}
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all disabled:opacity-70"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                    </button>
                </div>
              </div>
            </div>

            {/* Subscription / Plan (Mock for SaaS Phase 2) */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 opacity-80 relative overflow-hidden">
                {/* Coming Soon Overlay */}
                {/* <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                    <span className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">Em Breve</span>
                </div> */}

                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Assinatura & Plano</h3>
                        <p className="text-slate-500 text-sm">Gerencie seu plano de acesso</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-slate-200 shadow-sm text-2xl">
                            🎁
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">Plano Gratuito (Beta)</h4>
                            <p className="text-xs text-slate-500">Acesso antecipado com recursos ilimitados.</p>
                        </div>
                    </div>
                    <button className="text-indigo-600 font-bold text-sm hover:underline" disabled>
                        Gerenciar
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="border border-red-100 bg-red-50/50 p-6 rounded-2xl">
                <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Zona de Perigo
                </h3>
                <p className="text-sm text-red-600 mb-4">
                    Ações aqui são irreversíveis. Cuidado.
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={handleLogout}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}