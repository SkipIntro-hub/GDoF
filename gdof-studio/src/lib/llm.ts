import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GDoFCoefficients {
  scope: number; // T1 (1-5)
  depth: number; // T2 (1-5)
  format: number; // T3 (1-5)
  style: number; // R1 (1-5)
  logic: number; // R2 (1-5)
  rigor: number; // R3 (1-5)
}

export const getApiKey = (provider: 'gemini' | 'claude'): string => {
  return localStorage.getItem(`gdof_key_${provider}`) || '';
};

export const setApiKey = (provider: 'gemini' | 'claude', key: string) => {
  localStorage.setItem(`gdof_key_${provider}`, key);
};

export const getClaudeProxy = (): string => {
  return localStorage.getItem('gdof_claude_proxy') || '';
};

export const setClaudeProxy = (proxy: string) => {
  localStorage.setItem('gdof_claude_proxy', proxy);
};

// Generates the GDoF system prompt based on user inputs and slider values
export const generateGDoFSystemPrompt = (
  role: string,
  context: string,
  coefs: GDoFCoefficients
): string => {
  const translations = `
- **T1: Alcance (Scope) = ${coefs.scope}/5**: 
  ${coefs.scope === 1 ? 'Extremadamente acotado al problema específico, sin contexto periférico.' : 
    coefs.scope === 2 ? 'Acotado al problema y su impacto directo inmediato.' :
    coefs.scope === 3 ? 'Equilibrado. Cubre el problema principal y temas adyacentes importantes.' :
    coefs.scope === 4 ? 'Amplio. Incluye implicaciones de largo plazo, integraciones y contexto general.' :
    'Holístico / Sistémico. Conecta el problema con todo el ecosistema global, tendencias y ramificaciones indirectas.'}
- **T2: Profundidad (Depth) = ${coefs.depth}/5**:
  ${coefs.depth === 1 ? 'Nivel conceptual alto, explicaciones sencillas y sin detalles técnicos.' : 
    coefs.depth === 2 ? 'Explicación básica de mecanismos y lógica subyacente.' :
    coefs.depth === 3 ? 'Detalle moderado, explicando el "cómo" y el "por qué" con ejemplos prácticos.' :
    coefs.depth === 4 ? 'Análisis técnico exhaustivo, arquitectura detallada y casos de borde.' :
    'Profundidad máxima. Nivel experto absoluto, análisis molecular/código crudo, desgloses matemáticos o teóricos rigurosos.'}
- **T3: Formato (Format) = ${coefs.format}/5**:
  ${coefs.format === 1 ? 'Texto libre e informal, estructurado de forma orgánica.' : 
    coefs.format === 2 ? 'Lista de viñetas simple o párrafos cortos organizados.' :
    coefs.format === 3 ? 'Markdown estructurado con títulos claros, tablas simples y secciones.' :
    coefs.format === 4 ? 'Estructura corporativa rigurosa: Resumen Ejecutivo, Tablas de Datos, Código/Fórmulas y Anexos.' :
    'Formato ultra-estructurado. JSON rígido, especificación formal, plantillas YAML/XML estrictas, o diagramas de código y tablas multidimensionales.'}
`;

  const rotations = `
- **R1: Estilo (Style) = ${coefs.style}/5**:
  ${coefs.style === 1 ? 'Estilo ultra-humano, empático, informal, con contracciones y tono amigable.' : 
    coefs.style === 2 ? 'Conversacional profesional, cercano pero educado.' :
    coefs.style === 3 ? 'Tono neutro, balanceado y objetivo.' :
    coefs.style === 4 ? 'Tono técnico, formal, académico y analítico.' :
    'Estilo ultra-sintético, enciclopédico, frío y directo. Cero palabras de relleno o cortesías.'}
- **R2: Lógica (Logic) = ${coefs.logic}/5**:
  ${coefs.logic === 1 ? 'Pensamiento asociativo rápido, heurístico e intuitivo.' : 
    coefs.logic === 2 ? 'Lógica lineal estándar con explicaciones paso a paso breves.' :
    coefs.logic === 3 ? 'Razonamiento estructurado y deductivo claro.' :
    coefs.logic === 4 ? 'Lógica de primeros principios, análisis inductivo/deductivo y cadena de pensamiento (Chain of Thought).' :
    'Lógica formal ultra-rigurosa. Árbol de decisiones explícito, contrastación de hipótesis contrarias, justificación de cada premisa, análisis matemático si aplica.'}
- **R3: Rigor (Rigor) = ${coefs.rigor}/5**:
  ${coefs.rigor === 1 ? 'Generativo y creativo, prioriza dar una respuesta rápida aunque sea aproximada.' : 
    coefs.rigor === 2 ? 'Precisión general aceptable con supuestos simplificados.' :
    coefs.rigor === 3 ? 'Precisión contrastada, asumiendo límites normales y declarando fuentes lógicas.' :
    coefs.rigor === 4 ? 'Filtro estricto de sesgos, verificación de contradicciones y declaración explícita de incertidumbres.' :
    'Rigor científico absoluto. Declaración de limitaciones, control estricto de alucinaciones, análisis probabilístico de incertidumbre, y citas a leyes físicas/lógicas/matemáticas invariantes.'}
`;

  return `Eres un agente de Inteligencia Artificial especializado.
Tu Rol definido es: "${role}"
El Contexto de tu tarea es: "${context}"

Debes calibrar tu comportamiento y respuestas estrictamente basándote en los siguientes coeficientes GDoF (Guided Degrees of Freedom):

### TRASLACIONES (El contenido de la respuesta - QUÉ)
${translations}

### ROTACIONES (El comportamiento y tono - CÓMO)
${rotations}

INSTRUCCIÓN CRÍTICA DE COMPORTAMIENTO:
- Tu respuesta DEBE alinearse perfectamente con estos coeficientes.
- Si Rigor (R3) es alto (4-5), no hagas suposiciones y sé explícito sobre tus dudas.
- Si Estilo (R1) es bajo (1-2), sé conversacional y empático; si es alto (4-5), sé extremadamente directo y formal.
- Si Formato (T3) es alto (4-5), debes usar una estructura estricta y limpia según el nivel especificado.
- NO menciones explícitamente los coeficientes numéricos en tus respuestas finales a menos que se te pregunte por ellos. Solo actúa y responde según ellos.`;
};

// Call Gemini API
export const callGemini = async (
  apiKey: string,
  systemPrompt: string,
  history: Message[],
  modelName: string = 'gemini-2.5-flash'
): Promise<string> => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    // Map history to Gemini format (user -> user, assistant -> model)
    // We only take the previous messages as history, excluding the last one
    const geminiHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const lastMessage = history[history.length - 1].content;

    const chat = model.startChat({
      history: geminiHistory,
    });

    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error?.message || "Error al comunicarse con Gemini API.");
  }
};

// Call Anthropic Claude (supports direct call or proxy)
export const callClaude = async (
  apiKey: string,
  systemPrompt: string,
  history: Message[],
  proxyUrl: string = '',
  modelName: string = 'claude-3-5-sonnet-20241022'
): Promise<string> => {
  try {
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };

    // If using a proxy, we adjust the target URL
    const url = proxyUrl 
      ? `${proxyUrl.replace(/\/$/, '')}/v1/messages` 
      : 'https://api.anthropic.com/v1/messages';

    // Call Anthropic API
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errText);
      } catch {
        parsedError = { error: { message: errText } };
      }
      throw new Error(parsedError?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  } catch (error: any) {
    console.error("Claude API Error:", error);
    if (error.name === 'TypeError' && !proxyUrl) {
      throw new Error("Error de conexión. Las llamadas directas a Claude desde el navegador suelen fallar por CORS. Por favor, usa la opción de Proxy CORS en la configuración de la clave o utiliza Google Gemini (que sí soporta CORS nativo).");
    }
    throw new Error(error?.message || "Error al comunicarse con Claude API.");
  }
};

// Helper to optimize prompts using Gemini or Claude
export const callOptimizer = async (
  provider: 'gemini' | 'claude',
  apiKey: string,
  rawPrompt: string,
  proxyUrl: string = ''
): Promise<string> => {
  const optimizerSystemInstruction = `Eres un Ingeniero de Prompts Experto especializado en el framework GDoF (Guided Degrees of Freedom).
Tu tarea es tomar un prompt plano/simple provisto por el usuario y estructurarlo formalmente usando el estándar GDoF.

Debes devolver la respuesta en formato Markdown con las siguientes secciones:
1. **Calibración Sugerida (Coordenadas GDoF)**: Sugiere valores de 1 a 5 para:
   - Alcance (T1)
   - Profundidad (T2)
   - Formato (T3)
   - Estilo (R1)
   - Lógica (R2)
   - Rigor (R3)
   Acompaña cada valor con una breve justificación técnica de por qué se eligió.
2. **Rol Sugerido**: El nombre del rol/agente ideal (ej: Analista de Riesgo Crediticio, Auditor de Seguridad, Redactor de Ensayos Académicos).
3. **Contexto Sugerido**: Contexto de fondo necesario para el agente.
4. **Prompt GDoF Estructurado Final**: El prompt completo y formateado listo para copiar y usar en ChatGPT, Claude o Gemini, estructurando claramente el Rol, Contexto, Coeficientes de calibración GDoF y las instrucciones de respuesta.

Usa un tono formal, claro y profesional. Muestra un diseño premium de markdown con secciones ordenadas e íconos.`;

  const messages: Message[] = [
    {
      role: 'user',
      content: `Por favor optimiza este prompt original usando GDoF:\n\n"""\n${rawPrompt}\n"""`
    }
  ];

  if (provider === 'gemini') {
    return callGemini(apiKey, optimizerSystemInstruction, messages, 'gemini-2.5-flash');
  } else {
    return callClaude(apiKey, optimizerSystemInstruction, messages, proxyUrl, 'claude-3-5-sonnet-20241022');
  }
};
