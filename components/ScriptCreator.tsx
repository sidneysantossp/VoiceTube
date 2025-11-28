
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  BookOpen, 
  Wand2, 
  Users, 
  ListOrdered, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  Edit3, 
  FileText,
  BrainCircuit,
  Sparkles,
  ChevronRight,
  Target,
  Clock,
  MessageSquarePlus,
  X,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  Pencil,
  Maximize2
} from 'lucide-react';
import { ScriptBlock } from '../types';

interface ScriptCreatorProps {
  onExportScript: (blocks: ScriptBlock[]) => void;
  apiKey: string;
}

// Data Structures for the "Architect" Phase
interface Character {
  name: string;
  role: string;
  traits: string;
}

interface StoryBeat {
  act: string;
  title: string;
  description: string;
}

interface StoryStructure {
  title: string;
  logline: string;
  characters: Character[];
  outline: StoryBeat[];
}

const GENRE_SUGGESTIONS = [
  "Vídeo para YouTube", "Curta Metragem", "Podcast", "Comercial / Anúncio",
  "Tutorial Educativo", "Storytelling Narrativo", "Documentário", "Reels / TikTok (Viral)",
  "Meditação Guiada", "Audiolivro"
];

const TONE_SUGGESTIONS = [
  "Informativo & Sério", "Casual & Divertido", "Dramático & Emocional",
  "Energético & Hype", "Profissional & Corporativo", "Sarcástico & Irônico",
  "Inspirador & Motivacional", "Misterioso & Suspense"
];

const AUDIENCE_SUGGESTIONS = [
  "Público Geral",
  "Crianças (5-10 anos)",
  "Adolescentes (13-18 anos)",
  "Jovens Adultos (18-35 anos)",
  "Profissionais / Corporativo",
  "Empreendedores",
  "Estudantes / Acadêmicos",
  "Famílias",
  "Idosos (+60 anos)",
  "Fãs de Tecnologia",
  "Gamers",
  "Entusiastas de Fitness"
];

export default function ScriptCreator({ onExportScript, apiKey }: ScriptCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Inputs
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('Vídeo para YouTube');
  const [tone, setTone] = useState('Informativo & Sério');
  const [targetAudience, setTargetAudience] = useState('Público Geral');
  const [duration, setDuration] = useState('5 minutes');
  const [temperature, setTemperature] = useState(0.7);

  // Helper States for UI
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [isAudienceDropdownOpen, setIsAudienceDropdownOpen] = useState(false);
  const audienceRef = useRef<HTMLDivElement>(null);

  // Step 2: Architecture & Refinement
  const [structure, setStructure] = useState<StoryStructure | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementText, setRefinementText] = useState('');

  // Step 3: Final Script
  const [generatedBlocks, setGeneratedBlocks] = useState<ScriptBlock[]>([]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (audienceRef.current && !audienceRef.current.contains(event.target as Node)) {
        setIsAudienceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper to safely extract and parse JSON from mixed content
  const cleanAndParseJSON = (text: string) => {
      let cleaned = text;
      
      // 1. Regex Strategy: Try to extract a valid JSON object pattern { ... }
      // This helps when the AI puts text before or after the JSON
      try {
          const jsonMatch = text.match(/(\{[\s\S]*\})/); 
          if (jsonMatch) {
              // Further clean: if the match ends with garbage, try to find the last closing bracket that balances
              // A simple approach is finding the last '}'
              const potentialJson = jsonMatch[0];
              const lastBracketIndex = potentialJson.lastIndexOf('}');
              if (lastBracketIndex !== -1) {
                  cleaned = potentialJson.substring(0, lastBracketIndex + 1);
              } else {
                  cleaned = potentialJson;
              }
          } else {
              cleaned = text.replace(/```json\n?|```/g, '').trim();
          }
          
          const parsed = JSON.parse(cleaned);
          
          // 3. Post-parsing Validation: Truncate runaway strings
          if (parsed.title && typeof parsed.title === 'string' && parsed.title.length > 200) {
              parsed.title = parsed.title.substring(0, 197) + '...';
          }
          if (parsed.logline && typeof parsed.logline === 'string' && parsed.logline.length > 500) {
              parsed.logline = parsed.logline.substring(0, 497) + '...';
          }

          return parsed;
      } catch (e) {
          console.error("JSON Parse Error. Raw Text:", text);
          throw new Error("A IA gerou uma resposta inválida ou incompleta. Tente simplificar.");
      }
  };

  // Helper functions for Manual Editing
  const updateBeat = (index: number, field: keyof StoryBeat, value: string) => {
      if (!structure) return;
      const newOutline = [...structure.outline];
      newOutline[index] = { ...newOutline[index], [field]: value };
      setStructure({ ...structure, outline: newOutline });
  };

  const updateCharacter = (index: number, field: keyof Character, value: string) => {
      if (!structure) return;
      const newCharacters = [...structure.characters];
      newCharacters[index] = { ...newCharacters[index], [field]: value };
      setStructure({ ...structure, characters: newCharacters });
  };

  // --- AGENT 1: THE ARCHITECT ---
  const handleGenerateStructure = async () => {
    if (!premise.trim()) {
        setError("Por favor, descreva sua ideia.");
        return;
    }
    if (!apiKey) {
        setError("API Key não configurada. Configure no menu superior.");
        return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const prompt = `
        Atue como um Arquiteto de Histórias Profissional (Story Architect).
        
        Analise a seguinte premissa e crie a estrutura narrativa.
        Premissa: "${premise}"
        Gênero: ${genre}
        Tom: ${tone}
        Público: ${targetAudience}
        Duração Alvo: ${duration}

        Importante: Planeje a quantidade de cenas/beats para preencher aproximadamente ${duration} de conteúdo falado.
        
        REGRAS RÍGIDAS DE SAÍDA:
        1. NÃO use hashtags (#) em nenhum lugar.
        2. NÃO crie listas de palavras-chave no título.
        3. O título deve ser uma frase única e coerente (Max 100 caracteres).
        4. Responda APENAS com o JSON.

        Gere um JSON com:
        1. Um título cativante.
        2. Uma Logline (resumo de 1 frase).
        3. Lista de Personagens.
        4. Uma estrutura (Outline) dividida em batidas (Beats/Cenas).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            systemInstruction: "Você é um especialista em estruturação. Responda APENAS com JSON válido. PROIBIDO USAR HASHTAGS.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    logline: { type: Type.STRING },
                    characters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                role: { type: Type.STRING },
                                traits: { type: Type.STRING }
                            },
                            required: ["name", "role"]
                        }
                    },
                    outline: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                act: { type: Type.STRING, description: "Ex: Intro, Desenvolvimento, Clímax" },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["act", "title", "description"]
                        }
                    }
                },
                required: ["title", "logline", "outline"]
            },
            temperature: 0.4, 
            maxOutputTokens: 4096 
        }
      });

      const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (jsonText) {
          const parsed = cleanAndParseJSON(jsonText) as StoryStructure;
          setStructure(parsed);
          setStep(2);
      } else {
          throw new Error("Falha ao gerar JSON estruturado.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao criar a estrutura. Tente simplificar a premissa.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- AGENT 1.5: THE REFINER ---
  const handleRefineStructure = async () => {
      if (!structure || !refinementText.trim() || !apiKey) return;

      setIsProcessing(true);
      setError(null);

      try {
          const ai = new GoogleGenAI({ apiKey: apiKey });
          
          const prompt = `
            Atue como um Arquiteto de Histórias.
            Você gerou uma estrutura anteriormente, mas o usuário solicitou alterações.
            
            ESTRUTURA ATUAL (JSON):
            ${JSON.stringify(structure)}

            SOLICITAÇÃO DE MUDANÇA DO USUÁRIO:
            "${refinementText}"

            Tarefa: Reescreva a estrutura JSON completa incorporando as mudanças solicitadas. Mantenha o formato JSON estrito.
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction: "Atualize a estrutura do roteiro baseada no feedback. Responda APENAS com JSON válido. NÃO use hashtags.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        logline: { type: Type.STRING },
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    role: { type: Type.STRING },
                                    traits: { type: Type.STRING }
                                },
                                required: ["name", "role"]
                            }
                        },
                        outline: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    act: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["act", "title", "description"]
                            }
                        }
                    },
                    required: ["title", "logline", "outline"]
                },
                temperature: 0.5,
                maxOutputTokens: 4096 
            }
          });

          const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
              const parsed = cleanAndParseJSON(jsonText) as StoryStructure;
              setStructure(parsed);
              setIsRefining(false); 
              setRefinementText(''); 
          }

      } catch (err: any) {
          console.error(err);
          setError("Falha ao refinar a estrutura. Tente novamente.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- AGENT 2: THE WRITER ---
  const handleWriteScript = async () => {
    if (!structure || !apiKey) return;

    setIsProcessing(true);
    setError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const structureContext = JSON.stringify(structure, null, 2);

        const prompt = `
            Atue como um Roteirista Sênior (Lead Writer).
            
            Use a estrutura aprovada abaixo para escrever o roteiro completo.
            Separe o roteiro em blocos lógicos de texto (parágrafos ou falas).
            Mantenha o tom ${tone}.
            Duração Alvo do Roteiro: ${duration}.
            
            Instrução de Volume: Escreva conteúdo suficiente para cobrir ${duration} de fala em velocidade normal. Seja detalhado e expansivo para atingir esse tempo.
            
            ESTRUTURA APROVADA:
            ${structureContext}

            Instruções de Saída:
            Gere um JSON contendo um array de blocos de texto. Cada bloco deve ser uma parte do roteiro pronta para ser falada (TTS).
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction: "Você é um roteirista criativo. Responda APENAS com JSON válido. Escreva diálogos naturais. NÃO gere listas de hashtags. NÃO repita títulos infinitamente.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        blocks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING }
                                },
                                required: ["text"]
                            }
                        }
                    },
                    required: ["blocks"]
                },
                temperature: temperature, 
                maxOutputTokens: 8192 
            }
        });

        const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
            const parsed = cleanAndParseJSON(jsonText);
            
            if (parsed && Array.isArray(parsed.blocks)) {
                const scriptBlocks: ScriptBlock[] = parsed.blocks.map((b: any, index: number) => ({
                    id: `gen-script-${Date.now()}-${index}`,
                    text: b.text
                }));
                
                setGeneratedBlocks(scriptBlocks);
                setStep(3);
            } else {
                throw new Error("Formato de resposta inválido.");
            }
        }

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro ao escrever o roteiro.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- AGENT 3: THE EXPANDER (New) ---
  const handleExpandScript = async () => {
      if (!apiKey || !structure) return;
      setIsExpanding(true);
      setError(null);

      try {
          const ai = new GoogleGenAI({ apiKey: apiKey });
          
          // Context: Existing Script + Structure + Tone
          const currentScriptText = generatedBlocks.map(b => b.text).join('\n\n');
          
          const prompt = `
            ATUE COMO ROTEIRISTA SÊNIOR (Modo: Expansão).
            
            OBJETIVO:
            O usuário deseja expandir a história. Gere 2 a 3 novos blocos de roteiro que deem continuidade à narrativa atual ou aprofundem o final, SEM perder o foco do tema original.

            PREMISSA ORIGINAL: "${premise}"
            TOM APROVADO: ${tone}
            
            CONTEXTO ESTRUTURAL (Resumo):
            "${structure.logline}"

            ÚLTIMA PARTE DO ROTEIRO ATUAL (Contexto):
            "${currentScriptText.slice(-500)}"

            INSTRUÇÃO DE ESCRITA:
            Escreva a continuação natural. Não repita o que já foi dito. Mantenha a mesma voz e estilo.
            O conteúdo deve ser coerente com o que veio antes.
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction: "Gere novos blocos de roteiro JSON. Mantenha o foco. Não desvie do tema.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        new_blocks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING }
                                },
                                required: ["text"]
                            }
                        }
                    },
                    required: ["new_blocks"]
                },
                temperature: 0.7, 
                maxOutputTokens: 2048 
            }
          });

          const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
              const parsed = cleanAndParseJSON(jsonText);
              
              if (parsed && Array.isArray(parsed.new_blocks)) {
                  const newScriptBlocks: ScriptBlock[] = parsed.new_blocks.map((b: any, index: number) => ({
                      id: `expanded-script-${Date.now()}-${index}`,
                      text: b.text
                  }));
                  
                  setGeneratedBlocks(prev => [...prev, ...newScriptBlocks]);
              }
          }

      } catch (err: any) {
          console.error("Expand error:", err);
          setError("Erro ao expandir a história. Tente novamente.");
      } finally {
          setIsExpanding(false);
      }
  };

  const HelpTooltip = ({ type, options, onSelect }: { type: string, options: string[], onSelect: (val: string) => void }) => (
      <div className="absolute left-0 bottom-full mb-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 w-64 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Sugestões de {type}</span>
              <button onClick={() => setActiveHelp(null)}><X className="w-3 h-3 text-slate-400" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
              {options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { onSelect(opt); setActiveHelp(null); }}
                    className="text-[10px] px-2 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-md transition-colors text-left"
                  >
                      {opt}
                  </button>
              ))}
          </div>
          <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45 transform"></div>
      </div>
  );

  return (
    <div className="flex h-full bg-slate-50">
      
      {/* Workflow Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 hidden md:flex">
         <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                Criador IA
            </h2>
            <p className="text-xs text-slate-500">Fluxo de Roteirização Profissional</p>
         </div>

         <div className="space-y-6 relative">
            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-100 z-0"></div>

            <div className={`relative z-10 flex items-start gap-3 ${step === 1 ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1</div>
                <div>
                    <h3 className="font-bold text-slate-700 text-sm">Conceito</h3>
                    <p className="text-[10px] text-slate-500">Definição da ideia</p>
                </div>
            </div>

            <div className={`relative z-10 flex items-start gap-3 ${step === 2 ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2</div>
                <div>
                    <h3 className="font-bold text-slate-700 text-sm">Arquitetura</h3>
                    <p className="text-[10px] text-slate-500">Estrutura e Beats</p>
                </div>
            </div>

            <div className={`relative z-10 flex items-start gap-3 ${step === 3 ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3</div>
                <div>
                    <h3 className="font-bold text-slate-700 text-sm">Roteiro</h3>
                    <p className="text-[10px] text-slate-500">Edição Final</p>
                </div>
            </div>
         </div>
         
         {/* Progress Bar for Processing */}
         {isProcessing && (
             <div className="mt-auto bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-indigo-600 animate-pulse">
                         {step === 1 ? 'Criando Estrutura...' : step === 2 ? 'Refinando...' : 'Escrevendo...'}
                     </span>
                     <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                 </div>
                 <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full w-full animate-[progress_2s_ease-in-out_infinite] origin-left"></div>
                 </div>
             </div>
         )}

         {step === 3 && !isProcessing && (
             <div className="mt-auto">
                 <button 
                    onClick={() => onExportScript(generatedBlocks)}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                 >
                     <FileText className="w-4 h-4" />
                     Exportar para Voz
                 </button>
             </div>
         )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
         <div className="max-w-4xl mx-auto">
            
            {/* STEP 1: INPUTS */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Qual é a sua ideia?</h1>
                        <p className="text-slate-500">O Agente Arquiteto irá estruturar sua narrativa antes de escrevermos.</p>
                    </div>

                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Premissa / Ideia Central</label>
                            <textarea
                                value={premise}
                                onChange={(e) => setPremise(e.target.value)}
                                placeholder="Ex: Um documentário curto sobre a história do café, começando na Etiópia e terminando na Starbucks moderna..."
                                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-slate-700 transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    Formato / Gênero
                                    <button onClick={() => setActiveHelp(activeHelp === 'genre' ? null : 'genre')} className="text-slate-400 hover:text-indigo-500"><HelpCircle className="w-3.5 h-3.5" /></button>
                                </label>
                                {activeHelp === 'genre' && <HelpTooltip type="Gênero" options={GENRE_SUGGESTIONS} onSelect={setGenre} />}
                                <input
                                    type="text"
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Documentário, Podcast..."
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    Tom da Voz
                                    <button onClick={() => setActiveHelp(activeHelp === 'tone' ? null : 'tone')} className="text-slate-400 hover:text-indigo-500"><HelpCircle className="w-3.5 h-3.5" /></button>
                                </label>
                                {activeHelp === 'tone' && <HelpTooltip type="Tom" options={TONE_SUGGESTIONS} onSelect={setTone} />}
                                <input
                                    type="text"
                                    value={tone}
                                    onChange={(e) => setTone(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Sério, Divertido..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {/* Editable Audience Dropdown */}
                             <div className="relative" ref={audienceRef}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Público Alvo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value)}
                                        onClick={() => setIsAudienceDropdownOpen(true)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                                        placeholder="Selecione ou digite..."
                                    />
                                    <button 
                                        onClick={() => setIsAudienceDropdownOpen(!isAudienceDropdownOpen)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform ${isAudienceDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                                {isAudienceDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2">
                                        {AUDIENCE_SUGGESTIONS.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => {
                                                    setTargetAudience(suggestion);
                                                    setIsAudienceDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                             </div>

                             {/* Duration Selector */}
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    Duração Estimada
                                </label>
                                <select 
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="2 minutes">~2 Minutos (Curto)</option>
                                    <option value="5 minutes">~5 Minutos (Padrão)</option>
                                    <option value="10 minutes">~10 Minutos (Detalhado)</option>
                                    <option value="20 minutes">~20 Minutos (Aprofundado)</option>
                                    <option value="40 minutes">~40 Minutos (Documentário)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                <span>Criatividade (Temperatura)</span>
                                <span className="text-indigo-600 font-mono bg-indigo-50 px-2 rounded">{temperature}</span>
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>Preciso (Factual)</span>
                                <span>Criativo (Ficção)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleGenerateStructure}
                            disabled={isProcessing || !premise.trim()}
                            className={`px-8 py-4 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all ${
                                isProcessing 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200 transform hover:-translate-y-1'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    O Arquiteto está pensando...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5" />
                                    Gerar Estrutura
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: STRUCTURE REVIEW */}
            {step === 2 && structure && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Estrutura Aprovada?</h2>
                            <p className="text-slate-500">Revise e edite o plano criado pelo Arquiteto antes de escrever.</p>
                        </div>
                        <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-indigo-600 underline">
                            Voltar e Editar
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-6 border-b border-slate-200">
                             <h3 className="text-xl font-bold text-slate-800">{structure.title}</h3>
                             <p className="text-slate-600 italic mt-2">"{structure.logline}"</p>
                             <span className="inline-block mt-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                 Alvo: {duration}
                             </span>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Characters Col */}
                            <div className="md:col-span-1 space-y-4">
                                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Personagens (Editável)
                                </h4>
                                <div className="space-y-3">
                                    {structure.characters.map((char, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                                            <div className="flex items-center justify-between mb-1">
                                                <input 
                                                    value={char.name}
                                                    onChange={(e) => updateCharacter(idx, 'name', e.target.value)}
                                                    className="font-bold text-indigo-700 text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                                                />
                                                <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                            </div>
                                            <input 
                                                value={char.role}
                                                onChange={(e) => updateCharacter(idx, 'role', e.target.value)}
                                                className="text-xs text-slate-500 font-medium bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                                            />
                                            <input
                                                value={char.traits}
                                                onChange={(e) => updateCharacter(idx, 'traits', e.target.value)}
                                                className="text-xs text-slate-400 mt-1 bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Outline Col */}
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2">
                                    <ListOrdered className="w-4 h-4" />
                                    Beat Sheet (Editável)
                                </h4>
                                <div className="space-y-0 relative">
                                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200"></div>
                                    {structure.outline.map((beat, idx) => (
                                        <div key={idx} className="relative pl-10 pb-6 group">
                                            <div className="absolute left-2.5 top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm z-10"></div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow hover:border-indigo-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{beat.act}</span>
                                                    <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                
                                                <input 
                                                    value={beat.title}
                                                    onChange={(e) => updateBeat(idx, 'title', e.target.value)}
                                                    className="font-bold text-slate-800 mb-1 w-full bg-transparent border-none outline-none focus:ring-0 p-0 hover:bg-slate-50 rounded px-1 -ml-1 transition-colors"
                                                />
                                                
                                                <textarea
                                                    value={beat.description}
                                                    onChange={(e) => updateBeat(idx, 'description', e.target.value)}
                                                    className="text-sm text-slate-600 leading-relaxed w-full bg-transparent border-none outline-none focus:ring-0 p-0 hover:bg-slate-50 rounded px-1 -ml-1 transition-colors resize-none overflow-hidden h-auto"
                                                    style={{ minHeight: '60px' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button
                            onClick={() => setIsRefining(true)}
                            disabled={isProcessing}
                            className={`px-6 py-4 rounded-xl font-bold border-2 border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 flex items-center gap-2 transition-all ${
                                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            <MessageSquarePlus className="w-5 h-5" />
                            Solicitar Alterações (IA)
                        </button>

                        <button
                            onClick={handleWriteScript}
                            disabled={isProcessing}
                            className={`px-8 py-4 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all ${
                                isProcessing 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200 transform hover:-translate-y-1'
                            }`}
                        >
                             {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Escrevendo Roteiro...
                                </>
                            ) : (
                                <>
                                    <Edit3 className="w-5 h-5" />
                                    Aprovar & Escrever
                                </>
                            )}
                        </button>
                    </div>

                    {/* REFINEMENT MODAL */}
                    {isRefining && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95 relative">
                                <button 
                                    onClick={() => setIsRefining(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5 text-indigo-600" />
                                    Refinar Estrutura
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Não gostou de algo? Diga ao Arquiteto o que mudar e ele irá reescrever a estrutura para você.
                                </p>

                                <textarea
                                    value={refinementText}
                                    onChange={(e) => setRefinementText(e.target.value)}
                                    placeholder="Ex: O final está muito triste, mude para um final feliz. Adicione um antagonista no segundo ato."
                                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none mb-4"
                                />

                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => setIsRefining(false)}
                                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleRefineStructure}
                                        disabled={!refinementText.trim()}
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Gerar Nova Versão
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 3: FINAL OUTPUT */}
            {step === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                     <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">Roteiro Criado!</h2>
                        <p className="text-slate-500">Seu roteiro foi gerado e separado em {generatedBlocks.length} blocos de fala.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {generatedBlocks.map((block, idx) => (
                            <div key={block.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                                <div className="text-xs font-mono text-slate-400 w-6 pt-1">{idx + 1}</div>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{block.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="sticky bottom-6 flex justify-center gap-4">
                         <button
                            onClick={handleExpandScript}
                            disabled={isExpanding}
                            className={`bg-white hover:bg-indigo-50 text-indigo-700 border-2 border-indigo-100 px-8 py-4 rounded-full font-bold shadow-lg transition-all flex items-center gap-3 ${
                                isExpanding ? 'opacity-70 cursor-not-allowed' : ''
                            }`}
                            title="Adicionar mais conteúdo ao final do roteiro mantendo o contexto."
                         >
                             {isExpanding ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                             ) : (
                                <Maximize2 className="w-5 h-5" />
                             )}
                             {isExpanding ? 'Expandindo...' : 'Expandir História'}
                         </button>

                         <button
                            onClick={() => onExportScript(generatedBlocks)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-emerald-200/50 transform transition-all hover:scale-105 flex items-center gap-3"
                         >
                             <Sparkles className="w-5 h-5" />
                             Enviar para Estúdio de Voz
                             <ArrowRight className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            )}
            
            {/* Error Toast */}
            {error && (
                <div className="fixed bottom-8 right-8 bg-red-100 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 z-50">
                    <Target className="w-5 h-5" />
                    {error}
                </div>
            )}

         </div>
      </div>
    </div>
  );
}
