
import React, { useState } from 'react';
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
  Clock // Added Clock icon
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

export default function ScriptCreator({ onExportScript, apiKey }: ScriptCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Inputs
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('YouTube Video');
  const [tone, setTone] = useState('Informative');
  const [targetAudience, setTargetAudience] = useState('General Audience');
  const [duration, setDuration] = useState('5 minutes'); // New Duration State
  const [temperature, setTemperature] = useState(0.7);

  // Step 2: Architecture
  const [structure, setStructure] = useState<StoryStructure | null>(null);

  // Step 3: Final Script
  const [generatedBlocks, setGeneratedBlocks] = useState<ScriptBlock[]>([]);

  // Helper to safely extract and parse JSON from mixed content
  const cleanAndParseJSON = (text: string) => {
      // 1. Remove Markdown code blocks
      let cleaned = text.replace(/```json\n?|```/g, '').trim();
      
      // 2. Attempt to extract the JSON object using regex if there's trailing garbage
      // Matches from the first '{' to the last '}'
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          cleaned = jsonMatch[0];
      }

      try {
          const parsed = JSON.parse(cleaned);
          
          // 3. Post-parsing Validation: Truncate runaway strings
          // This protects the UI if the model generated a 5000-char title despite instructions
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

        Gere um JSON com:
        1. Um título cativante (MÁXIMO 100 caracteres).
        2. Uma Logline (resumo de 1 frase).
        3. Lista de Personagens (se aplicável ao gênero, ou apresentadores).
        4. Uma estrutura (Outline) dividida em batidas (Beats/Cenas).
      `;

      // Using JSON Schema for strict structural output
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            // STRICT INSTRUCTION TO PREVENT LOOPS
            systemInstruction: "Você é um especialista em estruturação de roteiros. Responda APENAS com JSON válido. NÃO use hashtags. NÃO repita palavras-chave. Títulos devem ser curtos e diretos.",
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
            temperature: 0.4, // Keep low for structural stability
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

  // --- AGENT 2: THE WRITER ---
  const handleWriteScript = async () => {
    if (!structure || !apiKey) return;

    setIsProcessing(true);
    setError(null);

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        // Construct context from the Architect's output
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
                maxOutputTokens: 8192 // High limit needed for long scripts
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

  return (
    <div className="flex h-full bg-slate-50">
      
      {/* Workflow Sidebar (Progress) */}
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
         <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                Criador IA
            </h2>
            <p className="text-xs text-slate-500">Fluxo de Roteirização Profissional</p>
         </div>

         <div className="space-y-6 relative">
            {/* Connecting Line */}
            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-100 z-0"></div>

            {/* Steps */}
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
         
         {step === 3 && (
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
      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
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
                                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-slate-700"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Formato / Gênero</label>
                                <select 
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="YouTube Video">Vídeo para YouTube</option>
                                    <option value="Short Film">Curta Metragem</option>
                                    <option value="Podcast">Podcast</option>
                                    <option value="Advertisement">Comercial / Anúncio</option>
                                    <option value="Tutorial">Tutorial Educativo</option>
                                    <option value="Storytelling">Storytelling Narrativo</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tom da Voz</label>
                                <select 
                                    value={tone}
                                    onChange={(e) => setTone(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Informative">Informativo & Sério</option>
                                    <option value="Casual">Casual & Divertido</option>
                                    <option value="Dramatic">Dramático & Emocional</option>
                                    <option value="Energetic">Energético & Hype</option>
                                    <option value="Professional">Corporativo & Profissional</option>
                                </select>
                            </div>
                        </div>

                        {/* New Duration Selector */}
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
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">
                                A IA ajustará a quantidade de cenas e o volume de texto baseada nesta escolha.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Público Alvo</label>
                                <input
                                    type="text"
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                    <span>Criatividade (Temperatura)</span>
                                    <span className="text-indigo-600">{temperature}</span>
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
                                    <span>Preciso</span>
                                    <span>Criativo</span>
                                </div>
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
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Estrutura Aprovada?</h2>
                            <p className="text-slate-500">Revise o plano criado pelo Arquiteto antes de escrever.</p>
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
                                    Personagens
                                </h4>
                                <div className="space-y-3">
                                    {structure.characters.map((char, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="font-bold text-indigo-700 text-sm">{char.name}</div>
                                            <div className="text-xs text-slate-500 font-medium">{char.role}</div>
                                            <div className="text-xs text-slate-400 mt-1">{char.traits}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Outline Col */}
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2">
                                    <ListOrdered className="w-4 h-4" />
                                    Beat Sheet (Escaleta)
                                </h4>
                                <div className="space-y-0 relative">
                                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200"></div>
                                    {structure.outline.map((beat, idx) => (
                                        <div key={idx} className="relative pl-10 pb-6 group">
                                            <div className="absolute left-2.5 top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm z-10"></div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{beat.act}</span>
                                                </div>
                                                <h5 className="font-bold text-slate-800 mb-1">{beat.title}</h5>
                                                <p className="text-sm text-slate-600 leading-relaxed">{beat.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
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
                                <p className="text-slate-700 leading-relaxed">{block.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="sticky bottom-6 flex justify-center">
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
                <div className="fixed bottom-8 right-8 bg-red-100 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <Target className="w-5 h-5" />
                    {error}
                </div>
            )}

         </div>
      </div>
    </div>
  );
}
