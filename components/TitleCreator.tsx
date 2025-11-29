

import React, { useState, useEffect } from 'react';
import { UserIntegrations } from '../types';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { 
  LayoutTemplate, 
  Sparkles, 
  Hash, 
  AlignLeft, 
  Copy, 
  Check, 
  Loader2, 
  Wand2,
  X,
  Save,
  Plus,
  Trash2,
  Edit,
  FolderOpen,
  Calendar,
  Search,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface TitleCreatorProps {
  apiKey: string;
  integrations?: UserIntegrations;
  onCreateScript?: (data: { title: string; description: string; tags: string[] }) => void;
}

interface Suggestion {
  type: 'title' | 'description' | 'tags';
  content: string | string[];
}

interface SEOProject {
  id: string;
  title: string;
  description: string;
  tags: string[];
  updatedAt: string;
}

export default function TitleCreator({ apiKey, integrations, onCreateScript }: TitleCreatorProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'editor' | 'library'>('editor');

  // Project Data State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  // Helpers State
  const [tagInput, setTagInput] = useState('');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Persistence State (Hybrid: Supabase + LocalStorage Fallback)
  const [projects, setProjects] = useState<SEOProject[]>(() => {
      try {
          const saved = localStorage.getItem('voice_tube_seo_projects');
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });

  // Load from Supabase on Mount
  useEffect(() => {
      const fetchProjects = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const { data, error } = await supabase
                  .from('seo_projects')
                  .select('*')
                  .eq('user_id', user.id)
                  .order('updated_at', { ascending: false });
              
              if (data && !error) {
                  const mapped: SEOProject[] = data.map(p => ({
                      id: p.id,
                      title: p.title,
                      description: p.description,
                      tags: p.tags || [],
                      updatedAt: p.updated_at
                  }));
                  setProjects(mapped);
              }
          }
      };
      fetchProjects();
  }, []);

  // Sync to LocalStorage (Backup)
  useEffect(() => {
      localStorage.setItem('voice_tube_seo_projects', JSON.stringify(projects));
  }, [projects]);

  // --- PROJECT MANAGEMENT ---

  const handleSaveProject = async () => {
      if (!title.trim()) {
          alert("O projeto precisa ter pelo menos um título.");
          return;
      }

      // 1. Get User
      const { data: { user } } = await supabase.auth.getUser();
      
      const newProjectData = {
          title,
          description,
          tags,
          updated_at: new Date().toISOString()
      };

      try {
          let savedId = currentProjectId;

          // Try Saving to Supabase
          if (user) {
              if (currentProjectId && !currentProjectId.startsWith('local-')) {
                  // Update
                  const { error } = await supabase
                      .from('seo_projects')
                      .update(newProjectData)
                      .eq('id', currentProjectId);
                  if (error) throw error;
              } else {
                  // Insert
                  const { data, error } = await supabase
                      .from('seo_projects')
                      .insert({
                          user_id: user.id,
                          created_at: new Date().toISOString(),
                          ...newProjectData
                      })
                      .select()
                      .single();
                  
                  if (error) throw error;
                  savedId = data.id;
              }
          } else {
              // Offline/Local Mode
              savedId = currentProjectId || `local-${Date.now()}`;
          }

          // Update Local State
          const newProject: SEOProject = {
              id: savedId!,
              title,
              description,
              tags,
              updatedAt: new Date().toISOString()
          };

          setProjects(prev => {
              const exists = prev.find(p => p.id === newProject.id);
              if (exists) {
                  return prev.map(p => p.id === newProject.id ? newProject : p);
              }
              return [newProject, ...prev];
          });

          setCurrentProjectId(newProject.id);
          
          // Show Success Toast
          setSuccessMessage("Projeto salvo com sucesso!");
          setTimeout(() => setSuccessMessage(null), 3000);

      } catch (err) {
          console.error("Erro ao salvar:", err);
          alert("Erro ao salvar no banco de dados. Salvando localmente.");
      }
  };

  const handleNewProject = () => {
      setTitle('');
      setDescription('');
      setTags([]);
      setCurrentProjectId(null);
      setSuggestions(null);
      setActiveTab('editor');
  };

  const handleLoadProject = (project: SEOProject) => {
      setTitle(project.title);
      setDescription(project.description);
      setTags(project.tags);
      setCurrentProjectId(project.id);
      setActiveTab('editor');
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm("Tem certeza que deseja excluir este projeto?")) {
          // Delete from Supabase
          if (!id.startsWith('local-')) {
              await supabase.from('seo_projects').delete().eq('id', id);
          }
          
          setProjects(prev => prev.filter(p => p.id !== id));
          if (currentProjectId === id) {
              handleNewProject();
          }
      }
  };

  // --- AI LOGIC ---

  const getActiveProvider = () => {
      const pref = integrations?.preferred_script_model || 'gemini';
      if (pref === 'openai' && !integrations?.openai_key) return 'gemini';
      return pref;
  };

  const activeProvider = getActiveProvider();

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

  const generateTitles = async () => {
      if (!description && !title) {
          alert("Preencha pelo menos um pouco da descrição ou um rascunho de título.");
          return;
      }
      setIsGenerating('title');
      try {
          const prompt = `Gere 5 opções de títulos para YouTube altamente clicáveis.
          Contexto:
          Título Rascunho: "${title}"
          Descrição: "${description}"
          
          REGRAS:
          1. Retorne APENAS uma lista simples separada por quebras de linha.
          2. NÃO numere a lista.
          3. NÃO use aspas.
          4. NÃO inclua textos introdutórios como "Aqui estão".`;
          
          const result = await callAI("Especialista em SEO para YouTube.", prompt);
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
          alert("Digite um título primeiro.");
          return;
      }
      setIsGenerating('desc');
      try {
          const prompt = `Escreva uma descrição completa e otimizada para YouTube para o vídeo: "${title}".
          
          REGRAS OBRIGATÓRIAS DE SAÍDA:
          1. Retorne APENAS o corpo do texto da descrição. NADA MAIS.
          2. NÃO comece com "Claro", "Com certeza", "Aqui está". Comece direto no Gancho.
          3. NÃO use formatação Markdown (sem negrito ** ou itálico *), pois o YouTube não suporta. Use CAIXA ALTA para destaques.
          4. Inclua: Gancho forte nas primeiras linhas, Resumo do conteúdo, CTA (Chamada para ação) e Links sugeridos (placeholders).`;
          
          const result = await callAI("Especialista em SEO para YouTube. Você é uma máquina que cospe texto puro.", prompt);
          
          // Post-processing cleanup just in case
          let cleanText = result
            .replace(/^Com certeza[\s\S]*?(\n\n|$)/i, '')
            .replace(/^Aqui está[\s\S]*?(\n\n|$)/i, '')
            .replace(/^Claro[\s\S]*?(\n\n|$)/i, '')
            .replace(/\*\*/g, '') // Remove bold markdown
            .replace(/__/g, '') // Remove italic markdown
            .trim();

          setSuggestions({ type: 'description', content: cleanText });
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
          const prompt = `Gere 15 tags de cauda longa separadas por vírgula para: "${title}". APENAS AS TAGS.`;
          const result = await callAI("Especialista em SEO.", prompt);
          const tagList = result.split(',').map(t => t.trim()).filter(t => t);
          setSuggestions({ type: 'tags', content: tagList });
      } catch (e) {
          console.error(e);
      } finally {
          setIsGenerating(null);
      }
  };

  // --- UI ACTIONS ---

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
      setSuggestions(null);
  };

  const applyAllTags = (newTags: string[]) => {
      setTags([...tags, ...newTags.filter(t => !tags.includes(t))]);
      setSuggestions(null);
  };

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
              <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percentage}%` }}></div>
          </div>
      );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 flex flex-col min-h-full relative">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <LayoutTemplate className="w-8 h-8 text-indigo-600" />
                    Estúdio de Títulos & SEO
                </h1>
                <p className="text-slate-500 mt-2">
                    Otimize metadados para YouTube com {activeProvider === 'openai' ? 'OpenAI' : 'Gemini'}.
                </p>
            </div>

            <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                            activeTab === 'editor' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Editor
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
                            activeTab === 'library' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Biblioteca
                        <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full text-[10px]">{projects.length}</span>
                    </button>
                </div>
            </div>
        </div>

        {/* EDITOR TAB */}
        {activeTab === 'editor' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 flex-1">
                
                {/* Toolbar */}
                <div className="flex justify-end gap-3 mb-6">
                    <button 
                        onClick={handleNewProject}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Novo
                    </button>
                    <button 
                        onClick={handleSaveProject}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-200 flex items-center gap-2 transition-all"
                    >
                        <Save className="w-4 h-4" />
                        {currentProjectId ? 'Atualizar Projeto' : 'Salvar Projeto'}
                    </button>
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
                        </div>

                        {/* Description Section */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <AlignLeft className="w-4 h-4 text-indigo-500" />
                                    Descrição
                                </label>
                                <button 
                                    onClick={generateDescription}
                                    disabled={isGenerating === 'desc'}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                                >
                                    {isGenerating === 'desc' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    Gerar com IA
                                </button>
                            </div>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Escreva sobre seu vídeo..."
                                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 leading-relaxed"
                            />
                            <div className="flex justify-between items-center mt-2">
                                <ProgressBar current={description.length} max={5000} />
                                <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{description.length} / 5000</span>
                            </div>
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
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 min-h-[60px] focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
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
                                <p className="text-[10px] text-slate-400">Enter para adicionar.</p>
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

                    {/* Right Column: AI & Actions */}
                    <div className="lg:col-span-1 space-y-6">
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
                                        <p className="text-sm text-slate-600 leading-relaxed mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
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
                            </div>
                        )}

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-700 text-sm mb-3">Ações Rápidas</h3>
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
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 flex-1">
                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400 text-center">
                        <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-bold text-slate-600">Nenhum projeto salvo</h3>
                        <p className="text-sm mt-1">Crie seu primeiro título e clique em salvar.</p>
                        <button 
                            onClick={handleNewProject}
                            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors"
                        >
                            Começar
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {projects.map((project) => (
                            <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all group flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight">
                                            {project.title || "Sem título"}
                                        </h3>
                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-start md:self-center w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                    <button 
                                        onClick={() => onCreateScript?.({ title: project.title, description: project.description, tags: project.tags })}
                                        className="flex-1 md:flex-none px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-emerald-100"
                                        title="Enviar para Criador de Roteiro"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Criar Roteiro
                                    </button>
                                    <button 
                                        onClick={() => handleLoadProject(project)}
                                        className="flex-1 md:flex-none px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-indigo-100"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Editar
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteProject(e, project.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-xl shadow-emerald-200/50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 z-50">
            <div className="bg-white/20 p-1.5 rounded-full">
                <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="font-bold text-sm">{successMessage}</p>
            <button 
                onClick={() => setSuccessMessage(null)}
                className="ml-2 text-emerald-100 hover:text-white transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
      )}
    </div>
  );
}