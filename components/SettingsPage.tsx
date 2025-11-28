
import React, { useState, useEffect } from 'react';
import { UserIntegrations } from '../types';
import { GoogleGenAI } from '@google/genai';
import { 
  Key, 
  Save, 
  ShieldCheck, 
  Cpu, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Bot, 
  Zap, 
  MessageSquareText,
  ExternalLink,
  Loader2,
  XCircle
} from 'lucide-react';

interface SettingsPageProps {
  integrations: UserIntegrations;
  onUpdateIntegrations: (newSettings: UserIntegrations) => void;
}

export default function SettingsPage({ integrations, onUpdateIntegrations }: SettingsPageProps) {
  const [formData, setFormData] = useState<UserIntegrations>(integrations);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  
  // Test States
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});

  useEffect(() => {
    setFormData(integrations);
  }, [integrations]);

  const toggleShowKey = (field: string) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field: keyof UserIntegrations, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    // Reset test status when key changes
    const provider = field.split('_')[0]; // gemini_key -> gemini
    setTestStatus(prev => ({ ...prev, [provider]: 'idle' }));
  };

  const handleSave = () => {
    onUpdateIntegrations(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testConnection = async (provider: 'gemini' | 'openai') => {
      const key = provider === 'gemini' ? formData.gemini_key : formData.openai_key;
      
      if (!key.trim()) {
          alert("Por favor, insira uma chave antes de testar.");
          return;
      }

      setTestingProvider(provider);
      setTestStatus(prev => ({ ...prev, [provider]: 'idle' }));

      try {
          if (provider === 'gemini') {
              const ai = new GoogleGenAI({ apiKey: key });
              await ai.models.generateContent({
                  model: "gemini-2.5-flash",
                  contents: [{ parts: [{ text: "Test" }] }]
              });
          } 
          else if (provider === 'openai') {
              const res = await fetch('https://api.openai.com/v1/models', {
                  headers: { 'Authorization': `Bearer ${key}` }
              });
              if (!res.ok) throw new Error("Falha na conexão OpenAI");
          }

          setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
      } catch (error) {
          console.error(`${provider} test failed:`, error);
          setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
      } finally {
          setTestingProvider(null);
      }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Cpu className="w-8 h-8 text-indigo-600" />
            Configurações & Integrações
          </h1>
          <p className="text-slate-500 mt-2">
            Conecte suas próprias chaves de API para ter autonomia total e limites maiores.
            Suas chaves são salvas <strong className="text-slate-700">apenas no seu navegador</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column: API Keys */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Google Gemini */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors ${testStatus.gemini === 'error' ? 'border-red-200' : testStatus.gemini === 'success' ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Google Gemini</h3>
                  <p className="text-xs text-slate-500">Essencial para Voz e Roteiro (Free Tier disponível)</p>
                </div>
                {testStatus.gemini === 'success' && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Conectado</span>}
                {testStatus.gemini === 'error' && <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> Erro</span>}
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                    <input 
                    type={showKeys['gemini'] ? "text" : "password"}
                    value={formData.gemini_key}
                    onChange={(e) => handleChange('gemini_key', e.target.value)}
                    placeholder="AIza..."
                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                    />
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button 
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                    {showKeys['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <button
                    onClick={() => testConnection('gemini')}
                    disabled={testingProvider === 'gemini' || !formData.gemini_key}
                    className={`px-4 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 ${
                        testStatus.gemini === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : testStatus.gemini === 'error'
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                >
                    {testingProvider === 'gemini' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {testingProvider === 'gemini' ? 'Testando' : 'Testar'}
                </button>
              </div>

              <div className="mt-2 text-right">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                      Obter chave no Google AI Studio
                      <ExternalLink className="w-3 h-3" />
                  </a>
              </div>
            </div>

            {/* OpenAI */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors ${testStatus.openai === 'error' ? 'border-red-200' : testStatus.openai === 'success' ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">OpenAI (GPT-4)</h3>
                  <p className="text-xs text-slate-500">Recomendado para roteiros complexos e criativos.</p>
                </div>
                {testStatus.openai === 'success' && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Conectado</span>}
                {testStatus.openai === 'error' && <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> Erro</span>}
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                    <input 
                    type={showKeys['openai'] ? "text" : "password"}
                    value={formData.openai_key}
                    onChange={(e) => handleChange('openai_key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                    />
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button 
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                    {showKeys['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <button
                    onClick={() => testConnection('openai')}
                    disabled={testingProvider === 'openai' || !formData.openai_key}
                    className={`px-4 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 ${
                        testStatus.openai === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : testStatus.openai === 'error'
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                >
                    {testingProvider === 'openai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {testingProvider === 'openai' ? 'Testando' : 'Testar'}
                </button>
              </div>

              <div className="mt-2 text-right">
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                      Obter chave na OpenAI Platform
                      <ExternalLink className="w-3 h-3" />
                  </a>
              </div>
            </div>

            {/* Anthropic (Coming Soon UI) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 opacity-80">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                  <MessageSquareText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Anthropic (Claude)</h3>
                  <p className="text-xs text-slate-500">Ótimo para textos longos e naturais.</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded ml-auto">Em breve</span>
              </div>
              <div className="relative">
                <input 
                  type="password"
                  disabled
                  placeholder="sk-ant..."
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl cursor-not-allowed"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <div className="mt-2 text-right">
                  <a 
                    href="https://console.anthropic.com/settings/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline inline-flex items-center gap-1 pointer-events-none opacity-50"
                  >
                      Obter chave no Anthropic Console
                      <ExternalLink className="w-3 h-3" />
                  </a>
              </div>
            </div>

          </div>

          {/* Right Column: Preferences */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Preferências de Modelo
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motor de Roteiro (Texto)</label>
                        <select 
                            value={formData.preferred_script_model}
                            onChange={(e) => handleChange('preferred_script_model', e.target.value as any)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                        >
                            <option value="gemini">Google Gemini (Padrão)</option>
                            <option value="openai" disabled={!formData.openai_key}>OpenAI GPT-4o {formData.openai_key ? '' : '(Requer Key)'}</option>
                            <option value="claude" disabled>Anthropic Claude (Em breve)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motor de Voz (Áudio)</label>
                        <select 
                            disabled
                            className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm text-slate-500 cursor-not-allowed"
                        >
                            <option>Google Gemini (Nativo)</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Apenas o Gemini suporta o modo de áudio nativo atual.</p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                    <button 
                        onClick={handleSave}
                        className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                            saved 
                            ? 'bg-emerald-500 shadow-emerald-200 shadow-lg' 
                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-200 shadow-lg'
                        }`}
                    >
                        {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                        {saved ? 'Salvo com Sucesso!' : 'Salvar Preferências'}
                    </button>
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
