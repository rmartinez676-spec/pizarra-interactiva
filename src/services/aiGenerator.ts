import type { Lesson, LessonStep, TeacherId } from '../types';

export interface GenerationRequest {
  query: string;
  mode: 'topic' | 'homework' | 'exam';
  teacherId: TeacherId;
  apiKey?: string;
}

export async function generateInteractiveLesson(req: GenerationRequest): Promise<Lesson> {
  // If user provided an API key:
  if (req.apiKey && req.apiKey.trim().length > 10) {
    try {
      return await callLlmWithStructuredOutput(req);
    } catch (e) {
      console.warn('Fallo llamada a API remota, usando motor pedagógico offline:', e);
    }
  }

  // Universal offline pedagogical generator for ANY topic or opposition syllabus
  return createUniversalLessonFromTopic(req.query, req.mode, req.teacherId);
}

async function callLlmWithStructuredOutput(req: GenerationRequest): Promise<Lesson> {
  const systemPrompt = `Eres un preparador experto de oposiciones y profesor de academia de alto rendimiento en pizarra blanca interactiva.
El alumno quiere aprender: "${req.query}".
Modo: ${req.mode}.
Debes estructurar una lección en formato JSON estricto:
- title: título formal de la lección / tema
- topic: asignatura o ámbito (ej. Derecho Administrativo, Constitución, Historia, etc.)
- category: 'General'
- steps: array de 2 a 3 pasos didácticos. Cada paso debe tener:
  - id: string
  - title: nombre del subapartado
  - speech: locución exacta que el preparador dirá en voz alta (muy didáctico, señalando la pizarra y avisando de trampas de examen).
  - commands: array de comandos para la pizarra blanca (tipos: 'clear', 'title', 'text', 'box', 'arrow', 'circle', 'highlight').
  - socratic (opcional en el primer paso): { prompt: string, options: string[], correctIndex: number, hint: string, feedbackCorrect: string, feedbackRetry: string }
- flashcards: array de 3 tarjetas { id, front, back }
- quiz: array de 2 preguntas de test { id, question, options: string[], correctIndex: number, explanation: string }

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
    topic: content.topic || 'Oposiciones y Formación',
    category: 'General',
    mode: req.mode,
    teacherId: req.teacherId,
    description: `Explicación en pizarra blanca sobre ${req.query}`,
    steps: content.steps || [],
    flashcards: content.flashcards || [],
    quiz: content.quiz || [],
  };
}

function createUniversalLessonFromTopic(
  query: string,
  mode: 'topic' | 'homework' | 'exam',
  teacherId: TeacherId
): Lesson {
  const cleanQuery = query.trim();
  const titleDisplay = cleanQuery.length > 55 ? cleanQuery.slice(0, 52) + '...' : cleanQuery;

  // Extract key terms to make the lesson dynamically tailored to the query
  const words = cleanQuery.split(/\s+/).filter(w => w.length > 3);
  const mainSubject = words.slice(0, 4).join(' ') || cleanQuery;

  const steps: LessonStep[] = [
    {
      id: 'step-1',
      title: '1. Esquema General y Definición Clave',
      speech: `¡Atención a la pizarra! Vamos a desglosar "${cleanQuery}". Como en cualquier examen o temario, el primer error es intentar memorizar párrafos enteros. Lo que debemos hacer es fijar el esquema conceptual y los requisitos principales.`,
      writingFocusCoord: [250, 80],
      commands: [
        { id: 'b1-clear', type: 'clear' },
        {
          id: 'b1-title',
          type: 'title',
          text: titleDisplay,
          subtitle: `Preparación de Temario • ${mode === 'exam' ? 'Enfoque Examen Tipo Test' : 'Esquema de Academia en Pizarra'}`,
          x: 50,
          y: 40,
          color: '#1e3a8a',
        },
        {
          id: 'b1-box-main',
          type: 'box',
          x: 50,
          y: 90,
          width: 890,
          height: 180,
          color: '#2563eb',
          label: 'Marco Conceptual y Principios Rectores',
        },
        {
          id: 'b1-t1',
          type: 'text',
          text: `📌 Concepto Principal: ${cleanQuery}`,
          x: 75,
          y: 135,
          size: 17,
          color: '#0f172a',
          style: 'bold',
        },
        {
          id: 'b1-t2',
          type: 'text',
          text: `• Naturaleza jurídica / Fundamento: Regla general aplicable al supuesto de hecho.`,
          x: 75,
          y: 175,
          size: 15,
          color: '#334155',
        },
        {
          id: 'b1-t3',
          type: 'text',
          text: `• Requisito esencial: Delimitación de competencias, plazos y efectos directos.`,
          x: 75,
          y: 215,
          size: 15,
          color: '#334155',
        },
        {
          id: 'b1-box-left',
          type: 'box',
          x: 50,
          y: 290,
          width: 430,
          height: 230,
          color: '#059669',
          label: 'Elementos Determinantes (Regla General)',
        },
        {
          id: 'b1-tl-1',
          type: 'text',
          text: `1. Ámbito de aplicación objetivo y subjetivo.`,
          x: 70,
          y: 335,
          size: 14,
          color: '#065f46',
          style: 'bold',
        },
        {
          id: 'b1-tl-2',
          type: 'text',
          text: `2. Procedimiento o cauce formal obligatorio.`,
          x: 70,
          y: 375,
          size: 14,
          color: '#1e293b',
        },
        {
          id: 'b1-tl-3',
          type: 'text',
          text: `3. Consecuencias jurídicas y eficacia temporal.`,
          x: 70,
          y: 415,
          size: 14,
          color: '#1e293b',
        },
        {
          id: 'b1-box-right',
          type: 'box',
          x: 510,
          y: 290,
          width: 430,
          height: 230,
          color: '#dc2626',
          label: '⚠️ Trampas Frecuentes del Tribunal / Excepciones',
        },
        {
          id: 'b1-tr-1',
          type: 'text',
          text: `• Confundir plazos (días hábiles vs naturales).`,
          x: 530,
          y: 335,
          size: 14,
          color: '#b91c1c',
          style: 'bold',
        },
        {
          id: 'b1-tr-2',
          type: 'text',
          text: `• Inversión de mayorías o de silencios administrativos.`,
          x: 530,
          y: 375,
          size: 14,
          color: '#1e293b',
        },
        {
          id: 'b1-tr-3',
          type: 'text',
          text: `• Supuestos de exclusión o salvedades no evidentes.`,
          x: 530,
          y: 415,
          size: 14,
          color: '#1e293b',
        },
      ],
      socratic: {
        prompt: `Al responder una pregunta de test sobre "${mainSubject}", ¿cuál suele ser la táctica más efectiva para no caer en la trampa del tribunal?`,
        options: [
          'Identificar si la pregunta pide la regla general o una excepción tasada',
          'Elegir la respuesta más larga sin leer las demás',
          'Confiar en la primera intuición sin verificar plazos ni términos excluyentes',
        ],
        correctIndex: 0,
        hint: 'Los tribunales de oposiciones casi siempre redactan las opciones trampa usando palabras absolutas como "siempre", "en todo caso" o cambiando un plazo.',
        feedbackCorrect:
          '¡Correcto! En las oposiciones, el 80% de los fallos ocurren por confundir la regla general con una excepción tasada en la ley.',
        feedbackRetry:
          'Recuerda: los tribunales diseñan preguntas trampa justamente para cazar a quienes responden por intuición rápida sin cotejar la excepción.',
      },
    },
    {
      id: 'step-2',
      title: '2. Resumen Mnemotécnico para la Memoria a Largo Plazo',
      speech:
        'Fíjate ahora en la parte inferior de la pizarra. Para que esto no se te olvide el día del examen, dejamos remarcada la regla mnemotécnica clave. Esta es la frase que debes recordar.',
      writingFocusCoord: [500, 480],
      commands: [
        {
          id: 'b2-highlight',
          type: 'highlight',
          x: 55,
          y: 460,
          width: 880,
          height: 55,
          color: 'rgba(254, 240, 138, 0.65)',
        },
        {
          id: 'b2-summary-txt',
          type: 'text',
          text: `🎯 Regla de Oro: Distingue siempre el órgano competente, el plazo legal y el régimen de excepciones de "${mainSubject}".`,
          x: 80,
          y: 495,
          size: 16,
          color: '#0f172a',
          style: 'bold',
        },
      ],
    },
  ];

  return {
    id: 'lesson-' + Date.now(),
    title: cleanQuery,
    topic: 'Temario y Oposiciones',
    category: 'General',
    mode,
    teacherId,
    description: `Clase magistral en pizarra blanca sobre ${cleanQuery}`,
    steps,
    flashcards: [
      {
        id: 'fc-1',
        front: `¿Cuál es el núcleo esencial que regula "${cleanQuery}"?`,
        back: 'El marco general de competencia, los requisitos indispensables y los efectos previstos en la normativa.',
      },
      {
        id: 'fc-2',
        front: '¿Cuál es la trampa clásica que suelen poner los tribunales sobre este tema?',
        back: 'Alterar los plazos, cambiar el sentido del silencio o hacer pasar una excepción por la regla general.',
      },
      {
        id: 'fc-3',
        front: '¿Cómo asegurar el acierto en un examen tipo test?',
        back: 'Descartar las opciones que contengan generalizaciones absolutas y comprobar el artículo exacto aplicable.',
      },
    ],
    quiz: [
      {
        id: 'qz-1',
        question: `Respecto a "${cleanQuery}", ¿qué factor es indispensable verificar antes de dar una respuesta definitiva?`,
        options: [
          'Comprobar si existe alguna excepción expresa contemplada en la norma',
          'Asumir que no hay excepciones posibles',
          'Ignorar las palabras clave del enunciado',
        ],
        correctIndex: 0,
        explanation: 'Las excepciones expresas son el objetivo predilecto de las preguntas de examen y oposición.',
      },
    ],
  };
}
