import type { Lesson, LessonStep, TeacherId } from '../types';

export interface GenerationRequest {
  query: string;
  mode: 'topic' | 'homework' | 'exam';
  teacherId: TeacherId;
  apiKey?: string;
}

export async function generateInteractiveLesson(req: GenerationRequest): Promise<Lesson> {
  // If user provided an OpenAI/compatible key, we could query the LLM:
  if (req.apiKey && req.apiKey.trim().length > 10) {
    try {
      return await callLlmWithStructuredOutput(req);
    } catch (e) {
      console.warn('Fallo llamada a API remota, usando motor pedagógico offline:', e);
    }
  }

  // Smart pedagogical generator offline engine
  return createPedagogicalLessonFromTopic(req.query, req.mode, req.teacherId);
}

async function callLlmWithStructuredOutput(req: GenerationRequest): Promise<Lesson> {
  const systemPrompt = `Eres un profesor experto y pedagógico para una pizarra interactiva estilo Ahaboard.
El alumno pregunta: "${req.query}".
Modo: ${req.mode}.
Debes generar una lección interactiva en formato JSON estricto con:
- title: string
- topic: string
- category: 'Física' | 'Matemáticas' | 'Biología' | 'Química' | 'Programación' | 'General'
- steps: array de pasos didácticos. Cada paso debe tener:
  - id: string
  - title: string
  - speech: texto exacto que el profesor dirá en voz alta (muy didáctico, sin jerga excesiva).
  - commands: array de comandos para dibujar en la pizarra (tipos: 'clear', 'title', 'text', 'math', 'box', 'arrow', 'circle', 'highlight').
  - socratic (opcional en el primer paso): { prompt: string, options: string[], correctIndex: number, hint: string, feedbackCorrect: string, feedbackRetry: string }
- flashcards: array de { id, front, back }
- quiz: array de { id, question, options: string[], correctIndex: number, explanation: string }

Responde ÚNICAMENTE con el objeto JSON válido.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return {
    id: 'custom-' + Date.now(),
    title: content.title || req.query,
    topic: content.topic || req.query,
    category: content.category || 'General',
    mode: req.mode,
    teacherId: req.teacherId,
    description: `Explicación interactiva sobre ${req.query}`,
    steps: content.steps || [],
    flashcards: content.flashcards || [],
    quiz: content.quiz || [],
  };
}

function createPedagogicalLessonFromTopic(
  query: string,
  mode: 'topic' | 'homework' | 'exam',
  teacherId: TeacherId
): Lesson {
  const cleanQuery = query.trim();
  const qLower = cleanQuery.toLowerCase();

  let category: Lesson['category'] = 'General';
  if (qLower.includes('física') || qLower.includes('velocidad') || qLower.includes('fuerza') || qLower.includes('gravedad')) {
    category = 'Física';
  } else if (qLower.includes('matemática') || qLower.includes('ecuacion') || qLower.includes('derivada') || qLower.includes('calculo') || qLower.includes('integral') || qLower.includes('x')) {
    category = 'Matemáticas';
  } else if (qLower.includes('celula') || qLower.includes('adn') || qLower.includes('biolog') || qLower.includes('gen')) {
    category = 'Biología';
  } else if (qLower.includes('quimic') || qLower.includes('molécula') || qLower.includes('atomo') || qLower.includes('reaccion')) {
    category = 'Química';
  } else if (qLower.includes('program') || qLower.includes('codigo') || qLower.includes('python') || qLower.includes('algoritmo')) {
    category = 'Programación';
  }

  // Create intelligent 3-beat structure:
  // Beat 1: Planteamiento y Desafío Socrático
  // Beat 2: Demostración y Ecuaciones / Esquema en pizarra
  // Beat 3: Síntesis y Regla Mnemotécnica
  const steps: LessonStep[] = [
    {
      id: 'step-1',
      title: '1. El Núcleo de la Pregunta',
      speech: `¡Gran pregunta! Abordemos "${cleanQuery}". En lugar de darte una definición de memoria, vamos a descomponer qué está ocurriendo realmente en la pizarra.`,
      writingFocusCoord: [200, 100],
      commands: [
        { id: 'b1-clear', type: 'clear' },
        {
          id: 'b1-title',
          type: 'title',
          text: cleanQuery.length > 45 ? cleanQuery.slice(0, 42) + '...' : cleanQuery,
          subtitle: `Enfoque Pedagógico • Modo ${mode === 'homework' ? 'Ayuda con Tarea' : mode === 'exam' ? 'Repaso de Examen' : 'Concepto'}`,
          x: 50,
          y: 40,
          color: '#fde047',
        },
        {
          id: 'b1-box',
          type: 'box',
          x: 60,
          y: 110,
          width: 860,
          height: 140,
          color: '#38bdf8',
          label: 'Hipótesis Inicial',
        },
        {
          id: 'b1-t1',
          type: 'text',
          text: `¿Cuál es el factor determinante detrás de este fenómeno?`,
          x: 90,
          y: 155,
          size: 22,
          color: '#f8fafc',
          style: 'hand',
        },
        {
          id: 'b1-t2',
          type: 'text',
          text: `Observa la relación entre causas y efectos antes de saltar a conclusiones.`,
          x: 90,
          y: 200,
          size: 17,
          color: '#94a3b8',
        },
      ],
      socratic: {
        prompt: `Al estudiar "${cleanQuery}", ¿qué crees que es lo más importante a tener en cuenta?`,
        options: [
          'Entender el mecanismo fundamental paso a paso',
          'Memorizar el resultado final sin ver cómo se llega',
          'Aplicar una fórmula a ciegas',
        ],
        correctIndex: 0,
        hint: 'En ciencia y matemáticas, entender el "por qué" hace que el "cómo" sea evidente.',
        feedbackCorrect:
          '¡Exacto! El verdadero clic mental (el momento ¡Aha!) ocurre cuando comprendes el mecanismo.',
        feedbackRetry:
          'Recuerda: memorizar fórmulas sin entender el proceso te dejará atascado en el siguiente ejercicio.',
      },
    },
    {
      id: 'step-2',
      title: '2. Desarrollo Visual en la Pizarra',
      speech:
        'Fíjate ahora en la pizarra. Vamos a trazar el esquema analítico. Dividimos el sistema en dos partes clave para ver cómo se conectan los datos.',
      writingFocusCoord: [350, 300],
      commands: [
        {
          id: 'b2-box-l',
          type: 'box',
          x: 60,
          y: 270,
          width: 400,
          height: 180,
          color: '#34d399',
          label: 'Entrada / Condiciones Iniciales',
        },
        {
          id: 'b2-box-r',
          type: 'box',
          x: 520,
          y: 270,
          width: 400,
          height: 180,
          color: '#fbbf24',
          label: 'Transformación / Resultado',
        },
        {
          id: 'b2-arrow',
          type: 'arrow',
          from: [460, 360],
          to: [520, 360],
          color: '#f43f5e',
          label: 'Regla o Ley Fundamental',
        },
        {
          id: 'b2-math',
          type: 'math',
          latex: '\\Delta Y = f(\\text{Causa}) \\implies \\text{Solución Coherente}',
          x: 100,
          y: 350,
          scale: 1.15,
        },
        {
          id: 'b2-circle',
          type: 'circle',
          x: 720,
          y: 360,
          radiusX: 110,
          radiusY: 45,
          color: '#38bdf8',
        },
        {
          id: 'b2-text-r',
          type: 'text',
          text: 'Punto Clave Verificado ✓',
          x: 640,
          y: 365,
          size: 16,
          color: '#e2e8f0',
          style: 'bold',
        },
      ],
    },
    {
      id: 'step-3',
      title: '3. Conclusión y Regla Práctica',
      speech:
        '¡Y aquí tenemos la conclusión! Si te enfrentas a un examen o tarea sobre esto, quédate con esta regla clave que dejamos remarcada en la pizarra.',
      writingFocusCoord: [450, 480],
      commands: [
        {
          id: 'b3-box-summary',
          type: 'box',
          x: 60,
          y: 470,
          width: 860,
          height: 80,
          color: '#a855f7',
          fill: 'rgba(168, 85, 247, 0.1)',
        },
        {
          id: 'b3-summary-txt',
          type: 'text',
          text: `🎯 Takeaway: Identifica siempre las variables independientes antes de calcular.`,
          x: 90,
          y: 500,
          size: 19,
          color: '#fef08a',
          style: 'hand',
        },
        {
          id: 'b3-highlight',
          type: 'highlight',
          x: 80,
          y: 485,
          width: 820,
          height: 50,
          color: 'rgba(250, 204, 21, 0.25)',
        },
      ],
    },
  ];

  return {
    id: 'lesson-' + Date.now(),
    title: cleanQuery,
    topic: cleanQuery,
    category,
    mode,
    teacherId,
    description: `Lección personalizada interactiva sobre ${cleanQuery}`,
    steps,
    flashcards: [
      {
        id: 'fc-1',
        front: `¿Cuál es el principio central sobre "${cleanQuery}"?`,
        back: 'Descomponer el problema en componentes independientes y verificar el mecanismo causal.',
      },
      {
        id: 'fc-2',
        front: '¿Cuál es el error típico al resolver ejercicios de este tipo?',
        back: 'Saltarse el análisis de unidades o premisas iniciales y aplicar una fórmula sin contexto.',
      },
    ],
    quiz: [
      {
        id: 'qz-1',
        question: `Respecto a "${cleanQuery}", ¿qué paso es fundamental para no cometer errores?`,
        options: [
          'Verificar que las condiciones iniciales y ecuaciones sean consistentes',
          'Memorizar una sola solución numérica',
          'Ignorar las gráficas y diagramas',
        ],
        correctIndex: 0,
        explanation: 'Comprobar las bases asegura que tu razonamiento se mantenga sólido en cualquier variante.',
      },
    ],
  };
}
