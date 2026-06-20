import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, 
  MessageSquare, 
  Sparkles, 
  Settings, 
  Eye, 
  Copy, 
  RefreshCw, 
  Key, 
  AlertTriangle, 
  Check, 
  Send, 
  ExternalLink 
} from 'lucide-react';
import { RadarChart } from './components/RadarChart';
import type { GDoFCoefficients, Message } from './lib/llm';
import { 
  generateGDoFSystemPrompt, 
  getApiKey, 
  setApiKey, 
  getClaudeProxy, 
  setClaudeProxy, 
  callGemini, 
  callClaude, 
  callOptimizer 
} from './lib/llm';

function App() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'builder' | 'playground' | 'optimizer'>('builder');

  // Agent Config
  const [role, setRole] = useState<string>('Analista de Riesgo Crediticio');
  const [context, setContext] = useState<string>('Evaluar la viabilidad financiera de MatchFin basándose en el balance trimestral.');
  const [coefs, setCoefs] = useState<GDoFCoefficients>({
    scope: 3,
    depth: 4,
    format: 3,
    style: 4,
    logic: 4,
    rigor: 5,
  });

  // System Prompt Preview
  const [systemPrompt, setSystemPrompt] = useState<string>('');

  useEffect(() => {
    setSystemPrompt(generateGDoFSystemPrompt(role, context, coefs));
  }, [role, context, coefs]);

  // Keys & Settings
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [claudeKey, setClaudeKey] = useState<string>('');
  const [claudeProxy, setClaudeProxyState] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'claude'>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');

  // Load keys on mount
  useEffect(() => {
    setGeminiKey(getApiKey('gemini'));
    setClaudeKey(getApiKey('claude'));
    setClaudeProxyState(getClaudeProxy());
  }, []);

  // Update selected model based on provider
  useEffect(() => {
    if (selectedProvider === 'gemini') {
      setSelectedModel('gemini-2.5-flash');
    } else {
      setSelectedModel('claude-3-5-sonnet-20241022');
    }
  }, [selectedProvider]);

  // Save keys
  const handleSaveKeys = () => {
    setApiKey('gemini', geminiKey);
    setApiKey('claude', claudeKey);
    setClaudeProxy(claudeProxy);
    setShowSettings(false);
    alert('Claves guardadas exitosamente en tu navegador.');
  };

  // Coherence validation
  interface CoherenceAlert {
    type: 'warning' | 'info' | 'success';
    message: string;
  }

  const getCoherenceAlerts = (): CoherenceAlert[] => {
    const alerts: CoherenceAlert[] = [];
    
    // T1 (Scope) vs T2 (Depth)
    if (coefs.scope === 5 && coefs.depth <= 2) {
      alerts.push({
        type: 'warning',
        message: 'Alcance (T1) alto con Profundidad (T2) baja: El agente intentará abarcar mucho contexto pero con explicaciones muy superficiales.'
      });
    }
    if (coefs.scope <= 2 && coefs.depth === 5) {
      alerts.push({
        type: 'info',
        message: 'Alcance (T1) acotado con Profundidad (T2) máxima: Excelente para análisis hyper-focalizados o depuración de código crítico.'
      });
    }

    // T2 (Depth) vs T3 (Format)
    if (coefs.depth >= 4 && coefs.format <= 2) {
      alerts.push({
        type: 'warning',
        message: 'Profundidad (T2) alta con Formato (T3) básico: Explicar conceptos técnicos complejos en texto plano informal puede dificultar la lectura. Sugerimos subir Formato a >= 3.'
      });
    }

    // R1 (Style) vs R3 (Rigor)
    if (coefs.style <= 2 && coefs.rigor === 5) {
      alerts.push({
        type: 'info',
        message: 'Estilo (R1) humano/cercano con Rigor (R3) científico: Genera un tono empático pero con verdades lógicas duras y asunciones estrictas.'
      });
    }
    if (coefs.style === 5 && coefs.rigor <= 2) {
      alerts.push({
        type: 'warning',
        message: 'Estilo (R1) enciclopédico frío con Rigor (R3) bajo: El agente responderá de forma cortante e impersonal, pero sus datos podrían contener imprecisiones creativas.'
      });
    }

    // R2 (Logic) vs R3 (Rigor)
    if (coefs.rigor === 5 && coefs.logic <= 2) {
      alerts.push({
        type: 'warning',
        message: 'Rigor (R3) científico con Lógica (R2) baja: Contradicción potencial. Es difícil mantener rigor sin una cadena de razonamiento estructurada. Sube Lógica a >= 4.'
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        message: 'Calibración balanceada. Los coeficientes GDoF son coherentes entre sí.'
      });
    }

    return alerts;
  };

  // Slider change helper
  const handleSliderChange = (axis: keyof GDoFCoefficients, val: number) => {
    setCoefs(prev => ({
      ...prev,
      [axis]: val
    }));
  };

  // Copy to clipboard helper
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Chat playground state
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy tu agente calibrado. ¿En qué puedo ayudarte bajo las coordenadas GDoF actuales?' }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Send message in Playground
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || chatLoading) return;

    const currentKey = selectedProvider === 'gemini' ? geminiKey : claudeKey;
    if (!currentKey) {
      setShowSettings(true);
      alert(`Por favor, ingresa tu API Key para ${selectedProvider === 'gemini' ? 'Gemini' : 'Claude'} en la pestaña de configuración.`);
      return;
    }

    const newUserMessage: Message = { role: 'user', content: inputMessage };
    const updatedHistory = [...chatMessages, newUserMessage];
    setChatMessages(updatedHistory);
    setInputMessage('');
    setChatLoading(true);

    try {
      let aiResponse = '';
      if (selectedProvider === 'gemini') {
        aiResponse = await callGemini(currentKey, systemPrompt, updatedHistory, selectedModel);
      } else {
        aiResponse = await callClaude(currentKey, systemPrompt, updatedHistory, claudeProxy, selectedModel);
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      { role: 'assistant', content: 'Conversación reiniciada. ¿En qué puedo ayudarte bajo las coordenadas GDoF actuales?' }
    ]);
  };

  // Prompt Optimizer State
  const [rawPromptInput, setRawPromptInput] = useState<string>('Necesito escribir un prompt para revisar balances financieros y detectar anomalías en transacciones.');
  const [optimizedOutput, setOptimizedOutput] = useState<string>('');
  const [optimizerLoading, setOptimizerLoading] = useState<boolean>(false);

  const handleOptimizePrompt = async () => {
    if (!rawPromptInput.trim()) return;
    const currentKey = selectedProvider === 'gemini' ? geminiKey : claudeKey;
    if (!currentKey) {
      setShowSettings(true);
      alert(`Necesitas configurar tu API Key de ${selectedProvider === 'gemini' ? 'Gemini' : 'Claude'} para utilizar el Optimizador.`);
      return;
    }

    setOptimizerLoading(true);
    setOptimizedOutput('');

    try {
      const result = await callOptimizer(selectedProvider, currentKey, rawPromptInput, claudeProxy);
      setOptimizedOutput(result);
    } catch (err: any) {
      setOptimizedOutput(`❌ Error en el proceso de optimización: ${err.message}`);
    } finally {
      setOptimizerLoading(false);
    }
  };

  // Check if API key is active helper
  const isKeyConfigured = (prov: 'gemini' | 'claude') => {
    return prov === 'gemini' ? !!geminiKey : !!claudeKey;
  };

  return (
    <div className="min-h-screen bg-[#07080f] grid-bg flex flex-col font-mono text-gray-200">
      {/* Top Banner */}
      <header className="border-b border-purple-950/40 bg-[#090b14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-purple-500/10">
              <div className="h-full w-full bg-[#07080f] rounded-lg flex items-center justify-center">
                <span className="font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">G</span>
              </div>
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg sm:text-xl tracking-wider text-white">GDoF STUDIO</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Guided Degrees of Freedom • Calibrador de Agentes</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="hidden md:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${isKeyConfigured('gemini') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                <span className="text-gray-400">Gemini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${isKeyConfigured('claude') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                <span className="text-gray-400">Claude</span>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-purple-950/40 border border-purple-500/20 hover:bg-purple-900/40 hover:border-purple-500/40 transition-all text-purple-300"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Configuración</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 gap-2">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 font-display transition-all ${
              activeTab === 'builder' 
                ? 'border-purple-500 text-white glow-text-purple' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="h-4 w-4 text-purple-400" />
            <span>1. Agent Builder</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 font-display transition-all ${
              activeTab === 'playground' 
                ? 'border-cyan-500 text-white glow-text-cyan' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span>2. Chat Playground</span>
          </button>
          <button
            onClick={() => setActiveTab('optimizer')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 font-display transition-all ${
              activeTab === 'optimizer' 
                ? 'border-pink-500 text-white glow-text-pink' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span>3. Prompt Optimizer</span>
          </button>
        </div>

        {/* Tab 1: Agent Builder */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Control Panel (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="glass-panel rounded-xl p-5 border border-purple-500/10">
                <h2 className="text-white text-base font-bold mb-4 flex items-center gap-2 border-b border-purple-950/40 pb-2">
                  <span className="text-purple-400 font-display">01 /</span> Identidad del Agente
                </h2>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Rol o Especialidad del Agente</label>
                    <input 
                      type="text" 
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ej: Auditor Legal, Senior React Dev..."
                      className="w-full bg-slate-950 border border-purple-900/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Contexto y Objetivos (Background)</label>
                    <textarea 
                      rows={3}
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Define brevemente qué problema resolverá y qué limitaciones operativas tiene..."
                      className="w-full bg-slate-950 border border-purple-900/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 resize-none font-sans"
                    />
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-5 border border-purple-500/10">
                <h2 className="text-white text-base font-bold mb-4 flex items-center gap-2 border-b border-purple-950/40 pb-2">
                  <span className="text-cyan-400 font-display">02 /</span> Coordenadas de Calibración
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Translations Column */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-xs font-semibold text-cyan-400 tracking-wider uppercase border-b border-cyan-950/30 pb-1">
                      Traslaciones (QUÉ responder)
                    </h3>
                    
                    {/* T1: Scope */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">T1: Alcance (Scope)</span>
                        <span className="text-cyan-400 font-bold">{coefs.scope}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.scope}
                        onChange={(e) => handleSliderChange('scope', parseInt(e.target.value))}
                        className="accent-cyan-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.scope === 1 && '1: Ultra acotado, al grano.'}
                        {coefs.scope === 2 && '2: Acotación focalizada.'}
                        {coefs.scope === 3 && '3: Contexto balanceado.'}
                        {coefs.scope === 4 && '4: Perspectiva periférica.'}
                        {coefs.scope === 5 && '5: Holístico, sistémico.'}
                      </p>
                    </div>

                    {/* T2: Depth */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">T2: Profundidad (Depth)</span>
                        <span className="text-cyan-400 font-bold">{coefs.depth}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.depth}
                        onChange={(e) => handleSliderChange('depth', parseInt(e.target.value))}
                        className="accent-cyan-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.depth === 1 && '1: Explicación básica/conceptual.'}
                        {coefs.depth === 2 && '2: Desglose general.'}
                        {coefs.depth === 3 && '3: Nivel intermedio práctico.'}
                        {coefs.depth === 4 && '4: Análisis técnico profundo.'}
                        {coefs.depth === 5 && '5: Nivel experto molecular.'}
                      </p>
                    </div>

                    {/* T3: Format */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">T3: Formato (Format)</span>
                        <span className="text-cyan-400 font-bold">{coefs.format}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.format}
                        onChange={(e) => handleSliderChange('format', parseInt(e.target.value))}
                        className="accent-cyan-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.format === 1 && '1: Texto libre conversacional.'}
                        {coefs.format === 2 && '2: Párrafos y viñetas simples.'}
                        {coefs.format === 3 && '3: Markdown estructurado.'}
                        {coefs.format === 4 && '4: Estructura ejecutiva formal.'}
                        {coefs.format === 5 && '5: Ultra-estructurado (JSON/YAML).'}
                      </p>
                    </div>
                  </div>

                  {/* Rotations Column */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-xs font-semibold text-purple-400 tracking-wider uppercase border-b border-purple-950/30 pb-1">
                      Rotaciones (CÓMO responder)
                    </h3>
                    
                    {/* R1: Style */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">R1: Estilo (Style)</span>
                        <span className="text-purple-400 font-bold">{coefs.style}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.style}
                        onChange={(e) => handleSliderChange('style', parseInt(e.target.value))}
                        className="accent-purple-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.style === 1 && '1: Humano, empático.'}
                        {coefs.style === 2 && '2: Conversacional fluido.'}
                        {coefs.style === 3 && '3: Neutro, objetivo.'}
                        {coefs.style === 4 && '4: Formal y académico.'}
                        {coefs.style === 5 && '5: Sintético y directo.'}
                      </p>
                    </div>

                    {/* R2: Logic */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">R2: Lógica (Logic)</span>
                        <span className="text-purple-400 font-bold">{coefs.logic}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.logic}
                        onChange={(e) => handleSliderChange('logic', parseInt(e.target.value))}
                        className="accent-purple-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.logic === 1 && '1: Heurística / Asociativa.'}
                        {coefs.logic === 2 && '2: Lineal breve.'}
                        {coefs.logic === 3 && '3: Deducción explicada.'}
                        {coefs.logic === 4 && '4: Cadena de Pensamiento (CoT).'}
                        {coefs.logic === 5 && '5: Primeros Principios formales.'}
                      </p>
                    </div>

                    {/* R3: Rigor */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-semibold">R3: Rigor (Rigor)</span>
                        <span className="text-purple-400 font-bold">{coefs.rigor}/5</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={coefs.rigor}
                        onChange={(e) => handleSliderChange('rigor', parseInt(e.target.value))}
                        className="accent-purple-500"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        {coefs.rigor === 1 && '1: Generativo / Creativo.'}
                        {coefs.rigor === 2 && '2: Precisión básica estándar.'}
                        {coefs.rigor === 3 && '3: Precisión contrastada.'}
                        {coefs.rigor === 4 && '4: Mitigación estricta de sesgos.'}
                        {coefs.rigor === 5 && '5: Certidumbre lógica absoluta.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizer & Outputs (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Radar Card */}
              <div className="glass-panel rounded-xl p-5 border border-purple-500/10 flex flex-col items-center">
                <h2 className="text-white text-xs font-bold font-display uppercase tracking-widest self-start border-b border-gray-800 pb-2 w-full mb-4">
                  Visualización de Grados de Libertad (6DoF)
                </h2>
                <RadarChart coefficients={coefs} />
              </div>

              {/* Coherence Alert System */}
              <div className="glass-panel rounded-xl p-5 border border-purple-500/10 flex flex-col gap-3">
                <h2 className="text-white text-xs font-bold font-display uppercase tracking-widest border-b border-gray-800 pb-2 w-full flex items-center gap-1.5">
                  <AlertTriangle className="h-4.5 w-4.5 text-yellow-500" />
                  <span>Validador de Coherencia</span>
                </h2>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                  {getCoherenceAlerts().map((alert, i) => (
                    <div 
                      key={i} 
                      className={`text-xs p-2.5 rounded border ${
                        alert.type === 'warning' 
                          ? 'bg-yellow-950/20 border-yellow-800/40 text-yellow-300' 
                          : alert.type === 'info'
                            ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-300'
                            : 'bg-green-950/20 border-green-800/40 text-green-300'
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>

              {/* System Prompt Copying */}
              <div className="glass-panel rounded-xl p-5 border border-purple-500/10 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h2 className="text-white text-xs font-bold font-display uppercase tracking-widest">
                    Prompt del Sistema Generado
                  </h2>
                  <button 
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 border border-purple-500/20 bg-purple-950/20 rounded px-2 py-1 transition-all"
                  >
                    {copiedPrompt ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedPrompt ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="h-[120px] overflow-y-auto text-[11px] text-gray-400 bg-slate-950/60 p-3 rounded border border-gray-900 font-mono select-all">
                  {systemPrompt}
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span>~ {Math.round(systemPrompt.length / 4)} tokens estimados</span>
                  <button 
                    onClick={() => setActiveTab('playground')}
                    className="text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Abrir en Chat Playground →</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Chat Playground */}
        {activeTab === 'playground' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[500px]">
            
            {/* Info bar / config summary (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="glass-panel rounded-xl p-4 border border-cyan-500/10 flex flex-col gap-4 h-full">
                <div>
                  <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase border-b border-gray-800 pb-2 mb-2 font-display">
                    Agente Activo
                  </h3>
                  <div className="text-sm font-semibold text-white truncate">{role}</div>
                  <div className="text-[11px] text-gray-400 mt-1 line-clamp-3 font-sans">{context}</div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase border-b border-gray-800 pb-2 mb-2 font-display">
                    Calibración
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">T1 ALCANCE</span>
                      <span className="text-white font-bold">{coefs.scope}/5</span>
                    </div>
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">T2 PROFUNDIDAD</span>
                      <span className="text-white font-bold">{coefs.depth}/5</span>
                    </div>
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">T3 FORMATO</span>
                      <span className="text-white font-bold">{coefs.format}/5</span>
                    </div>
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">R1 ESTILO</span>
                      <span className="text-white font-bold">{coefs.style}/5</span>
                    </div>
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">R2 LÓGICA</span>
                      <span className="text-white font-bold">{coefs.logic}/5</span>
                    </div>
                    <div className="bg-slate-950/40 p-1.5 rounded border border-gray-900">
                      <span className="text-gray-500 block text-[9px]">R3 RIGOR</span>
                      <span className="text-white font-bold">{coefs.rigor}/5</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-900 flex flex-col gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">PROVEEDOR</label>
                    <select 
                      value={selectedProvider} 
                      onChange={(e) => setSelectedProvider(e.target.value as 'gemini' | 'claude')}
                      className="w-full bg-slate-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="claude">Anthropic Claude</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">MODELO</label>
                    <select 
                      value={selectedModel} 
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-slate-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {selectedProvider === 'gemini' ? (
                        <>
                          <option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado)</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        </>
                      ) : (
                        <>
                          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
                          <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                        </>
                      )}
                    </select>
                  </div>

                  <button 
                    onClick={handleClearChat}
                    className="w-full mt-2 py-1.5 bg-gray-950 hover:bg-gray-900 border border-gray-800 rounded text-center text-xs text-gray-400 hover:text-white transition-all"
                  >
                    Reiniciar Chat
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Panel (9 cols) */}
            <div className="lg:col-span-9 flex flex-col gap-4">
              
              {/* Chat Container */}
              <div className="glass-panel rounded-xl border border-cyan-500/10 flex flex-col flex-grow h-[500px]">
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-gray-900 flex justify-between items-center bg-[#0a0c16]/50">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-bold font-display uppercase tracking-widest text-white">Consola de Diálogo</span>
                  </div>

                  <button 
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{showMetadata ? 'Ocultar Metadatos' : 'Inspeccionar GDoF Payload'}</span>
                  </button>
                </div>

                {/* Optional Metadata View */}
                {showMetadata && (
                  <div className="bg-[#0b0c15] border-b border-gray-900 p-4 text-[10px] text-gray-400 max-h-[150px] overflow-y-auto font-mono">
                    <div className="text-cyan-400 font-bold mb-1">SYSTEM_INSTRUCTION (Enviado al modelo):</div>
                    <pre className="whitespace-pre-wrap select-text">{systemPrompt}</pre>
                  </div>
                )}

                {/* Messages List */}
                <div className="flex-grow overflow-y-auto p-5 flex flex-col gap-4">
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i}
                      className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">
                        {msg.role === 'user' ? 'TÚ (Usuario)' : `${role} (Agente)`}
                      </span>
                      <div 
                        className={`rounded-lg p-3 text-xs md:text-sm font-sans whitespace-pre-wrap leading-relaxed select-text ${
                          msg.role === 'user' 
                            ? 'bg-cyan-950/40 border border-cyan-500/20 text-cyan-100' 
                            : 'bg-purple-950/20 border border-purple-500/20 text-purple-100'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex flex-col max-w-[85%] self-start items-start">
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">{role} (Agente)</span>
                      <div className="rounded-lg p-3 text-xs bg-purple-950/10 border border-purple-500/10 text-purple-300 flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                        <span>Generando respuesta estructurada GDoF...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input Footer */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-900 bg-[#090b14]/60 flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={chatLoading}
                    placeholder={`Pregúntale a tu agente calibrado en ${role}...`}
                    className="flex-grow bg-slate-950 border border-gray-800 rounded px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-500/60"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !inputMessage.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs md:text-sm flex items-center gap-1.5 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-950/30"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>

              </div>

            </div>

          </div>
        )}

        {/* Tab 3: Prompt Optimizer */}
        {activeTab === 'optimizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Input (Left) */}
            <div className="glass-panel rounded-xl p-5 border border-pink-500/10 flex flex-col gap-4">
              <div>
                <h2 className="text-white text-base font-bold font-display uppercase tracking-widest border-b border-pink-950/40 pb-2 mb-3">
                  Prompt a Optimizar
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  Pega un prompt estándar y desestructurado. El Optimizador invocará un modelo avanzado de IA para analizarlo, clasificarlo y transformarlo en una plantilla rígida gobernada bajo los coeficientes **GDoF**.
                </p>
              </div>

              <div className="flex-grow flex flex-col">
                <textarea
                  rows={12}
                  value={rawPromptInput}
                  onChange={(e) => setRawPromptInput(e.target.value)}
                  placeholder="Pega tu prompt plano aquí..."
                  className="w-full flex-grow bg-slate-950 border border-pink-900/30 rounded p-4 text-xs md:text-sm text-white font-sans focus:outline-none focus:border-pink-500/60 resize-none"
                />
              </div>

              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase">Utilizar:</span>
                  <select 
                    value={selectedProvider} 
                    onChange={(e) => setSelectedProvider(e.target.value as 'gemini' | 'claude')}
                    className="bg-slate-950 border border-gray-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
                <button
                  onClick={handleOptimizePrompt}
                  disabled={optimizerLoading || !rawPromptInput.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded text-xs md:text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-pink-950/20 disabled:opacity-50"
                >
                  {optimizerLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Estructurando Prompt...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Optimizar con GDoF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output (Right) */}
            <div className="glass-panel rounded-xl p-5 border border-pink-500/10 flex flex-col gap-4 min-h-[400px]">
              <div className="flex justify-between items-center border-b border-pink-950/40 pb-2 mb-1">
                <h2 className="text-white text-base font-bold font-display uppercase tracking-widest">
                  Resultado Estructurado GDoF
                </h2>
                
                {optimizedOutput && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(optimizedOutput);
                      alert('Prompt estructurado copiado al portapapeles.');
                    }}
                    className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 border border-pink-500/20 bg-pink-950/20 rounded px-2.5 py-1 transition-all"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Resultado</span>
                  </button>
                )}
              </div>

              {optimizedOutput ? (
                <div className="flex-grow overflow-y-auto p-4 bg-slate-950/60 rounded border border-gray-900 text-xs md:text-sm leading-relaxed text-gray-300 font-sans whitespace-pre-wrap select-text">
                  {optimizedOutput}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-8 border border-dashed border-gray-900 rounded">
                  <Sparkles className="h-10 w-10 text-pink-950/60 mb-2" />
                  <p className="text-xs uppercase tracking-widest">Esperando optimización</p>
                  <p className="text-[10px] text-gray-600 mt-1 max-w-[280px]">Presiona el botón de la izquierda para generar una calibración formal.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Global Config Drawer / Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-xl border border-purple-500/30 max-w-md w-full p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-white text-lg font-bold flex items-center gap-2 font-display">
                <Key className="h-5 w-5 text-purple-400" />
                <span>Configurar Claves API</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Tus claves se guardan localmente en el almacenamiento del navegador (`localStorage`) y nunca se envían a ningún servidor intermedio.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Google Gemini API Key</label>
                <input 
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-gray-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
                <span className="text-[9px] text-gray-500 block mt-1">
                  Obtén tu clave de forma gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="h-2 w-2" /></a>.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Anthropic Claude API Key</label>
                <input 
                  type="password"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-950 border border-gray-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Proxy CORS para Claude (Opcional)</label>
                <input 
                  type="text"
                  value={claudeProxy}
                  onChange={(e) => setClaudeProxyState(e.target.value)}
                  placeholder="Ej: https://mi-proxy.cors.workers.dev"
                  className="w-full bg-slate-950 border border-gray-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
                <span className="text-[9px] text-gray-500 block mt-1">
                  Requerido para Claude desde la web debido a las restricciones de CORS de Anthropic. Déjalo en blanco si usas Gemini.
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded text-xs bg-gray-950 border border-gray-800 text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveKeys}
                className="px-4 py-2 rounded text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-900 bg-[#04060b] py-6 text-center text-xs text-gray-600">
        <p>© 2026 GDoF Studio. Desarrollado para SkipIntro-hub.</p>
        <p className="text-[10px] mt-1 text-gray-700">El paradigma de Grados de Libertad Guiados calibra rigurosamente la heurística, forma y profundidad de la inteligencia artificial.</p>
      </footer>
    </div>
  );
}

export default App;
