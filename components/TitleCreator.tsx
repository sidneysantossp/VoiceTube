
import React, { useState } from 'react';
import { UserIntegrations } from '../types';
import { GoogleGenAI } from '@google/genai';
import { 
  LayoutTemplate, 
  Sparkles, 
  Hash, 
  AlignLeft, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2, 
  ThumbsUp, 
  AlertCircle,
  Wand2,
  Plus,
  X
} from 'lucide-react';

interface TitleCreatorProps {
  apiKey: string;
  integrations?: UserIntegrations;
}

interface Suggestion {
  type: 'title' | 'description' | 'tags';
  content: string | string[];
}

export default function TitleCreator({ apiKey, integrations }: TitleCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const [isGenerating, setIsGenerating] = useState<string | null>(null); // 'title', 'desc', 'tags'
  const [suggestions, setSuggestions] = useState<Suggestion | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Helper to get active provider
  const getActiveProvider = () => {
      const pref = integrations?.preferred_script_model || 'gemini';
      if (pref === 'openai' && !integrations?.openai_key) return 'gemini';
      return pref;
  };

  const activeProvider = getActiveProvider();

  // --- AI CALLER ---
  const callAI = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      if (activeProvider === 'openai' && integrations?.openai_key) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${integrations.openai_key}`
              },
              body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userPrompt }
                  ],
                  temperature: 0.7,
              })
          });
          const data = await res.json();
          return data.choices[0].message.content;
      } else {
          // Fallback to Gemini
          const keyToUse = integrations?.gemini_key || apiKey;
          if (!keyToUse) throw new Error("API Key não configurada");
          
          const ai = new GoogleGenAI({ apiKey: keyToUse });
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
            }
          });
          return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
  };

  // --- GENERATORS ---

  const generateTitles = async () => {
      if (!description && !title) {
          alert("Preencha pelo menos um pouco da descrição ou um rascunho de título para basear as sugestões.");
          return;
      }
      setIsGenerating('title');
      try {
          const prompt = `Gere 5 opções de títulos para YouTube altamente clicáveis (Clickbait ético, Curiosidade, Lista ou "Como fazer").
          Baseado neste contexto:
          Título Rascunho: "${title}"
          Descrição: "${description}"
          
          Retorne APENAS uma lista simples separada por quebras de linha. Sem numeração, sem aspas, sem texto introdutório.`;
          
          const result = await callAI("Especialista em SEO para YouTube.", prompt);
          
          // Parse string result into array
          const titleList = result.split('\n')
            .map(t => t.replace(/^\d+[\.\)]\s*/, '').replace(/^-\s*/, '').replace(/"/g, '').trim())
            .filter(t => t.length > 0);

          setSuggestions({ type: 'title', content: titleList });
      } catch (e) {
          console.error(e);
          alert("Erro ao gerar títulos.");
      } finally {
          setIsGenerating(null);
      }
  };

  const generateDescription = async () => {
      if (!title) {
          alert("Digite um título primeiro para gerar a descrição.");
          return;
      }
      setIsGenerating('desc');
      try {
          const prompt = `Escreva uma descrição otimizada para YouTube (SEO) para o vídeo com título: "${title}".
          Inclua:
          1. Um gancho inicial forte (primeiras 2 linhas).
          2. Resumo do conteúdo.
          3. Chamada para ação (CTA).
          
          Retorne apenas o texto da descrição.`;
          
          const result = await callAI("Especialista em SEO para YouTube.", prompt);
          setSuggestions({ type: 'description', content: result });
      } catch (e) {
          console.error(e);
      } finally {
          setIsGenerating(null);
      }
  };

  const generateTags = async () => {
      if (!title) {
          alert("Digite um título primeiro.");
          return;
      }
      setIsGenerating('tags');
      try {
          const prompt = `Gere 15 tags de cauda longa (long-tail keywords) separadas por vírgula para este vídeo: "${title}".`;
          const result = await callAI("Especialista em SEO.", prompt);
          // Clean list
          const tagList = result.split(',').map(t => t.trim()).filter(t => t);
          setSuggestions({ type: 'tags', content: tagList });
      } catch (e) {
          console.error(e);
      } finally {
          setIsGenerating(null);
      }
  };

  // --- UTILS ---

  const copyToClipboard = (text: string, field: string) => {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
  };

  const addTag = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && tagInput.trim()) {
          if (!tags.includes(tagInput.trim())) {
              setTags([...tags, tagInput.trim()]);
          }
          setTagInput('');
      }
  };

  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  const applySuggestion = (val: string) => {
      if (suggestions?.type === 'title') setTitle(val);
      if (suggestions?.type === 'description') setDescription(val);
      if (suggestions?.type === 'tags') {
          // If it's a list (from Generate Tags)
          // Usually handled separately, but if single tag clicked
      }
      setSuggestions(null);
  };

  const applyAllTags = (newTags: string[]) => {
      setTags([...tags, ...newTags.filter(t => !tags.includes(t))]);
      setSuggestions(null);
  };

  // --- RENDER HELPERS ---

  const ProgressBar = ({ current, max }: { current: number, max: number }) => {
      const percentage = Math.min((current / max) * 100, 100);
      
      let color = 'bg-slate-300';
      if (current > 0) {
          if (percentage < 10) color = 'bg-slate-400';
          else if (percentage <= 90) color = 'bg-emerald-500'; 
          else if (percentage <= 100) color = 'bg-yellow-400'; 
          else color = 'bg-red-500'; 
      }

      return (
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full ${color} transition-all duration-300`} 
                style={{ width: `${percentage}%` }}
              ></div>
          </div>
      );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header */}
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <LayoutTemplate className="w-8 h-8 text-indigo-600" />
                    Estúdio de Títulos & SEO
                </h1>
                <p className="text-slate-500 mt-2">
                    Otimize seus metadados para o algoritmo do YouTube com ajuda da IA ({activeProvider === 'openai' ? 'OpenAI' : 'Gemini'}).
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Inputs */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Title Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                            Título do Vídeo
                        </label>
                        <span className={`text-xs font-mono px-2 py-1 rounded ${title.length > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                            {title.length} / 100
                        </span>
                    </div>
                    
                    <div className="relative">
                        <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Como fazer café perfeito em casa..."
                            className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium text-slate-800"
                        />
                        <button 
                            onClick={generateTitles}
                            disabled={isGenerating === 'title'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
                            title="Gerar sugestões de título com IA"
                        >
                            {isGenerating === 'title' ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <Sparkles className="w-5 h-5" />}
                        </button>
                    </div>
                    
                    <ProgressBar current={title.length} max={100} />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>Curto</span>
                        <span className="text-emerald-600 font-bold">Ideal (60 chars)</span>
                        <span>Limite (100)</span>
                    </div>
                </div>

                {/* Description Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <AlignLeft className="w-4 h-4 text-indigo-500" />
                            Descrição
                        </label>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={generateDescription}
                                disabled={isGenerating === 'desc'}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                            >
                                {isGenerating === 'desc' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                Gerar com IA
                            </button>
                            <span className={`text-xs font-mono px-2 py-1 rounded ${description.length > 5000 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                {description.length} / 5000
                            </span>
                        </div>
                    </div>
                    
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Escreva sobre seu vídeo..."
                        className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 leading-relaxed"
                    />
                    
                    {/* Progress Bar for 5000 chars */}
                    <ProgressBar current={description.length} max={5000} />
                </div>

                {/* Tags Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-indigo-500" />
                            Tags
                        </label>
                        <button 
                            onClick={generateTags}
                            disabled={isGenerating === 'tags'}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                        >
                            {isGenerating === 'tags' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Sugerir Tags
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 min-h-[60px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                        {tags.map(tag => (
                            <span key={tag} className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-sm flex items-center gap-1 shadow-sm">
                                {tag}
                                <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        <input 
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={addTag}
                            placeholder={tags.length === 0 ? "Digite uma tag e pressione Enter..." : ""}
                            className="flex-1 bg-transparent border-none outline-none text-sm p-1 min-w-[150px]"
                        />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <p className="text-[10px] text-slate-400">Pressione Enter para adicionar.</p>
                        <button 
                            onClick={() => copyToClipboard(tags.join(','), 'tags')}
                            className="text-xs text-indigo-600 hover:text-indigo-500 font-bold flex items-center gap-1"
                        >
                            {copiedField === 'tags' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Copiar todas
                        </button>
                    </div>
                </div>

            </div>

            {/* Right Column: Suggestions & Actions */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Suggestions Card */}
                {suggestions ? (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 animate-in fade-in slide-in-from-right-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                Sugestões de IA
                            </h3>
                            <button onClick={() => setSuggestions(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>

                        {suggestions.type === 'title' && Array.isArray(suggestions.content) && (
                            <div className="space-y-2">
                                {suggestions.content.map((suggestion, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => applySuggestion(suggestion)}
                                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all text-sm text-slate-700 hover:text-indigo-800"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}

                        {suggestions.type === 'description' && typeof suggestions.content === 'string' && (
                            <div>
                                <p className="text-sm text-slate-600 leading-relaxed mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                                    {suggestions.content}
                                </p>
                                <button 
                                    onClick={() => applySuggestion(suggestions.content as string)}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-500"
                                >
                                    Usar Descrição
                                </button>
                            </div>
                        )}

                        {suggestions.type === 'tags' && Array.isArray(suggestions.content) && (
                            <div>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {suggestions.content.map((tag, idx) => (
                                        <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs border border-indigo-100">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => applyAllTags(suggestions.content as string[])}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-500"
                                >
                                    Adicionar Todas
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                        <Wand2 className="w-8 h-8 mb-3 opacity-20" />
                        <p className="text-sm font-medium">As sugestões da IA aparecerão aqui.</p>
                        <p className="text-xs mt-1">Clique nos ícones mágicos nos inputs para gerar.</p>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 text-sm mb-3">Ações Rápidas</h3>
                    <div className="space-y-2">
                        <button 
                            onClick={() => copyToClipboard(`${title}\n\n${description}\n\nTags: ${tags.join(', ')}`, 'all')}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors text-sm font-medium border border-slate-100 hover:border-indigo-100"
                        >
                            <span>Copiar Metadados Completos</span>
                            {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

            </div>

        </div>
      </div>
    </div>
  );
}
