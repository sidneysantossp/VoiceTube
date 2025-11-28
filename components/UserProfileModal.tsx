import React from 'react';
import { UserProfile } from '../types';
import { X, User, Mail, Shield, Calendar, Fingerprint } from 'lucide-react';

interface UserProfileModalProps {
  user: any; // Supabase session user object
  profile: UserProfile | null;
  onClose: () => void;
}

export default function UserProfileModal({ user, profile, onClose }: UserProfileModalProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600 border-4 border-white shadow-lg">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{profile?.full_name || 'Usuário Voice Tube'}</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
             profile?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
          }`}>
             {profile?.role === 'admin' ? 'Administrador' : 'Membro Gratuito'}
          </span>
        </div>

        <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                        <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 uppercase font-bold">Email</p>
                        <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                        <Fingerprint className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 uppercase font-bold">User ID</p>
                        <p className="text-xs font-mono text-slate-600 truncate bg-slate-200/50 px-1 py-0.5 rounded w-fit">
                            {user.id}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 uppercase font-bold">Membro desde</p>
                        <p className="text-sm font-medium text-slate-700">
                            {new Date(profile?.created_at || user.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-6 flex justify-end">
            <button 
                onClick={onClose}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
            >
                Fechar
            </button>
        </div>
      </div>
    </div>
  );
}