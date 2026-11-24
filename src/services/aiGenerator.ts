import type { AIProvider, BoardCommand, Lesson, LessonStep, TeacherId } from '../types';

export interface GenerationRequest {
  query: string;
  mode: 'topic' | 'homework' | 'exam';
  teacherId: TeacherId;
  apiKey?: string;
  provider?: AIProvider;
  attachmentText?: string;
}

export interface InterruptionResponse {
  speech: string;
  commands: BoardCommand[];
}

export async function generateInteractiveLesson(req: GenerationRequest): Promise<Lesson> {
  if (req.apiKey && req.apiKey.trim().length > 8) {
    try {
      return await callLlmWithStructuredOutput(req);
    } catch (e) {
      console.warn('Fallo llamada a API remota, usando motor pedagógico offline:', e);
    }
  }

  return createUniversalLessonFromTopic(req.query, req.mode, req.teacherId, req.attachmentText);
}

export async function answerStudentInterruption(params: {
  question: string;
  lessonTitle: string;
  currentStepTitle: string;
  currentSpeech: string;
  apiKey?: string;
  provider?: AIProvider;
}): Promise<InterruptionResponse> {
  const { question, lessonTitle, currentStepTitle, currentSpeech, apiKey, provider } = params;

  if (apiKey && apiKey.trim().length > 8) {
    try {
      const prompt = `Eres ahaboard, un tutor que DIBUJA en una pizarra blanca (coordenadas 0..1000 x 0..580).
Estabas explicando "${lessonTitle}" (paso: "${currentStepTitle}", decías: "${currentSpeech}").
El estudiante te ha interrumpido con: "${question}".

Responde de tú a tú, claro y cercano, y DIBUJA en la zona inferior (y entre 370 y 530) usando flechas ("arrow"), círculos ("circle"), curvas ("curve") y anotaciones cortas ("text") sin borrar lo anterior. No uses cajas rectangulares aburridas.
Devuelve ÚNICAMENTE JSON válido:
{
  "speech": "Texto que dirás en voz alta respondiendo directamente al estudiante",
  "commands": [
    { "id": "int-1", "type": "arrow", "from": [80, 410], "to": [180, 450], "color": "#7c3aed" },
    { "id": "int-2", "type": "text", "text": "Aclaración visual...", "x": 195, "y": 455, "size": 17, "color": "#4c1d95", "style": "bold" }
  ]
}`;

      const raw = await callRawJsonLlm(prompt, apiKey, provider || 'gemini');
      const parsed = JSON.parse(raw);
      return {
        speech: parsed.speech || 'Buena pregunta. Te lo dibujo aquí mismo en la pizarra.',
        commands: Array.isArray(parsed.commands) ? parsed.commands : [],
      };
    } catch (e) {
      console.warn('Error en interrupción con LLM, usando respuesta local:', e);
    }
  }

  // Smart local fallback for interruptions (draws arrow + circle + handwritten note)
  const lowerQ = question.toLowerCase();
  let replySpeech = `¡Buena pregunta! Para responderte sobre "${question}" con total libertad y dibujarte esquemas nuevos a medida, conecta tu clave gratuita de Gemini arriba en "Conectar IA". Mientras tanto, quédate con esta flecha clave en morado.`;
  if (lowerQ.includes('a la vez') || lowerQ.includes('mismo tiempo') || lowerQ.includes('iguales')) {
    replySpeech = `¡Exacto! Llegan exactamente a la vez porque la gravedad tira hacia abajo con la misma aceleración para las dos.`;
  }

  return {
    speech: replySpeech,
    commands: [
      {
        id: 'int-arrow-' + Date.now(),
        type: 'arrow',
        from: [70, 420],
        to: [160, 470],
        color: '#7c3aed',
        label: 'Mira aquí',
      },
      {
        id: 'int-circle-' + Date.now(),
        type: 'circle',
        x: 520,
        y: 470,
        radiusX: 340,
        radiusY: 32,
        color: '#7c3aed',
      },
      {
        id: 'int-txt-' + Date.now(),
        type: 'text',
        text: `${replySpeech.slice(0, 78)}${replySpeech.length > 78 ? '...' : ''}`,
        x: 200,
        y: 476,
        size: 16,
        color: '#4c1d95',
        style: 'bold',
      },
    ],
  };
}

async function callRawJsonLlm(prompt: string, apiKey: string, provider: AIProvider): Promise<string> {
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  }

  const endpoint =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callLlmWithStructuredOutput(req: GenerationRequest): Promise<Lesson> {
  const attachmentSection = req.attachmentText
    ? `\n\nEl alumno ha adjuntado estos apuntes/texto de referencia. Basa tu clase principalmente en este contenido:\n"""\n${req.attachmentText.slice(0, 6000)}\n"""`
    : '';

  const modeInstructions =
    req.mode === 'exam'
      ? 'Modo EXAMEN: Repasa puntos clave, señala trampas típicas de tribunal/examen y termina con cuestionario.'
      : req.mode === 'homework'
      ? 'Modo TAREA: Guía paso a paso dando pistas socráticas sin regalar la respuesta final de golpe.'
      : 'Modo TEMA: Explica el concepto de raíz a fondo con esquemas visuales, comparaciones y claridad.';

  const systemPrompt = `Eres ahaboard, un tutor experto que DIBUJA VISUALMENTE cada concepto en una pizarra blanca (canvas 1000x580).
El alumno quiere aprender: "${req.query}".
${modeInstructions}${attachmentSection}

REGLA DE ORO DE LA PIZARRA (MUY IMPORTANTE):
¡NO hagas diapositivas aburridas con cajas rectangulares llenas de texto! Dibuja como un profesor humano con rotuladores de colores:
- Usa "curve" con arrays de puntos [[x1,y1],[x2,y2],...] para dibujar curvas, arcos, montañas, líneas de tiempo, balanzas, pirámides, ondas, gráficas o trayectorias.
- Usa "circle" para dibujar nodos, átomos, bolas, engranajes o rodear conceptos clave.
- Usa "arrow" para conectar causas, fuerzas, flujos o consecuencias.
- Usa "text" con anotaciones CORTAS a mano alzada justo al lado de cada dibujo.
- Usa "diagram" (kind: "projectile" o "photosynthesis") cuando encaje con física o biología.

Estructura JSON estricta:
{
  "title": "Título claro de la clase",
  "topic": "Asignatura o materia",
  "category": "General",
  "steps": [
    {
      "id": "step-1",
      "title": "Nombre del paso",
      "speech": "Explicación natural, cercana y didáctica en español que dirás en voz alta mientras dibujas este paso.",
      "commands": [
        { "id": "c1", "type": "clear" },
        { "id": "c2", "type": "title", "text": "Título en pizarra", "subtitle": "Idea visual", "x": 50, "y": 42, "color": "#1e3a8a" },
        { "id": "c3", "type": "curve", "points": [[100,320],[220,180],[350,150],[480,220],[600,350]], "color": "#2563eb", "lineWidth": 3, "label": "Trayectoria" },
        { "id": "c4", "type": "circle", "x": 220, "y": 180, "radiusX": 22, "color": "#dc2626" },
        { "id": "c5", "type": "arrow", "from": [220, 205], "to": [220, 290], "color": "#dc2626", "label": "Fuerza" }
      ],
      "socratic": {
        "prompt": "Pregunta directa al estudiante para comprobar que lo entiende",
        "options": ["Opción A", "Opción B", "Opción C"],
        "correctIndex": 0,
        "hint": "Pista breve",
        "feedbackCorrect": "¡Exacto! ...",
        "feedbackRetry": "Casi, fíjate en..."
      }
    }
  ],
  "flashcards": [
    { "id": "fc-1", "front": "Pregunta rápida", "back": "Respuesta" }
  ],
  "quiz": [
    { "id": "qz-1", "question": "Pregunta de test", "options": ["A", "B", "C"], "correctIndex": 0, "explanation": "Explicación" }
  ]
}

Reglas de coordenadas (1000x580):
- Tipos permitidos: "clear", "title", "text", "curve", "circle", "arrow", "highlight", "box" (úsalo solo para destacar una fórmula o regla final, nunca para listas largas).
- Crea 2 o 3 pasos progresivos (en el paso 2 y 3 NO pongas "clear" para que se siga dibujando sobre la misma pizarra).
Responde ÚNICAMENTE con el JSON válido.`;

  const raw = await callRawJsonLlm(systemPrompt, req.apiKey!, req.provider || 'gemini');
  const content = JSON.parse(raw);

  return {
    id: 'custom-' + Date.now(),
    title: content.title || req.query,
    topic: content.topic || 'Tutoría con Pizarra',
    category: 'General',
    mode: req.mode,
    teacherId: req.teacherId,
    description: `Explicación en pizarra blanca sobre ${req.query}`,
    steps: content.steps || [],
    flashcards: content.flashcards || [],
    quiz: content.quiz || [],
  };
}

// Rich knowledge-base for topics in oposiciones, law, and academic subjects
interface TopicKnowledge {
  keywords: string[];
  title: string;
  topic: string;
  box1Label: string;
  box1Lines: { text: string; size: number; color: string; bold?: boolean }[];
  box2Label: string;
  box2Lines: { text: string; size: number; color: string; bold?: boolean }[];
  speech1: string;
  speech2: string;
  summaryRule: string;
  socratic: {
    prompt: string;
    options: string[];
    correctIndex: number;
    hint: string;
    feedbackCorrect: string;
    feedbackRetry: string;
  };
  flashcards: { front: string; back: string }[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
}

const TOPIC_KNOWLEDGE_BASE: TopicKnowledge[] = [
  {
    keywords: ['corona', 'rey', 'refrendo', 'titulo ii', '56', '64'],
    title: 'La Corona y el Refrendo Real: Arts. 56 a 65 de la Constitución',
    topic: 'Derecho Constitucional • Título II CE',
    box1Label: '1. Estatuto del Rey e Inviolabilidad (Art. 56)',
    box1Lines: [
      { text: '• El Rey es el Jefe del Estado, símbolo de su unidad y permanencia.', size: 15, color: '#0f172a', bold: true },
      { text: '• Inviolabilidad: NO está sujeto a responsabilidad política ni penal.', size: 16, color: '#dc2626', bold: true },
      { text: '• Sus actos carecen de validez sin el REFRENDO obligatorio.', size: 16, color: '#1e3a8a', bold: true },
      { text: '• Responsabilidad: Se traslada a las personas que refrendan.', size: 15, color: '#047857', bold: true }
    ],
    box2Label: '2. ¿Quién Refrenda los Actos del Rey? (Art. 64 CE)',
    box2Lines: [
      { text: '• Regla General: Presidente del Gobierno y Ministros competentes.', size: 15, color: '#0f172a', bold: true },
      { text: '• EXCEPCIÓN DE EXAMEN: Refrenda el Presidente del Congreso:', size: 15, color: '#dc2626', bold: true },
      { text: '  a) Propuesta y nombramiento del Presidente del Gobierno (Art. 99).', size: 14, color: '#1e293b' },
      { text: '  b) Disolución de las Cortes si no hay investidura en 2 meses (99.5).', size: 14, color: '#1e293b' },
      { text: '• Actos libres del Rey: Distribución de la Casa Real (Art. 65.2).', size: 14, color: '#047857', bold: true }
    ],
    speech1: '¡Atención al Título Segundo de la Constitución! El Rey es el Jefe del Estado y según el artículo 56.3 su persona es inviolable y no está sujeta a responsabilidad. Por eso, para que sus actos sean válidos necesitan siempre el refrendo. La responsabilidad de los actos del Rey recae directamente sobre las personas que los refrendan.',
    speech2: 'Ahora fijaos en la derecha: ¿quién refrenda al Rey? En el noventa por ciento de los casos, el Presidente del Gobierno o los Ministros. Pero el tribunal siempre os preguntará por la excepción: el Presidente del Congreso refrenda la propuesta y nombramiento del Presidente del Gobierno tras las elecciones y la disolución automática de las Cortes si pasan dos meses sin investidura.',
    summaryRule: 'El Rey nunca es responsable: responden el Presidente del Gobierno y Ministros, o el Presidente del Congreso en los casos tasados del artículo 99.',
    socratic: {
      prompt: '¿Quién refrenda la disolución de las Cortes prevista en el artículo 99.5 de la Constitución por falta de acuerdo de investidura tras dos meses?',
      options: [
        'El Presidente del Congreso de los Diputados',
        'El Presidente del Gobierno en funciones',
        'El Presidente del Senado'
      ],
      correctIndex: 0,
      hint: 'Es una de las pocas facultades de refrendo reservadas en exclusiva a la presidencia de la Cámara Baja.',
      feedbackCorrect: '¡Perfecto! El artículo 64.2 de la CE otorga esta función al Presidente del Congreso, trampa habitual en los exámenes de oposición.',
      feedbackRetry: 'Cuidado: el Presidente del Gobierno no puede refrendar esa disolución automática porque las Cortes no han alcanzado un acuerdo.'
    },
    flashcards: [
      { front: '¿De quién es la responsabilidad jurídica de los actos del Rey?', back: 'De las personas que los refrendan (Presidente del Gobierno, Ministros o Presidente del Congreso).' },
      { front: '¿Qué actos del Rey no necesitan refrendo?', back: 'El nombramiento y relevo de los miembros civiles y militares de su Casa y la distribución de la partida presupuestaria (Art. 65).' }
    ],
    quiz: {
      question: 'El nombramiento del Presidente del Gobierno por el Rey es refrendado por:',
      options: ['El Presidente del Congreso', 'El Presidente del Gobierno saliente', 'El Presidente del Tribunal Constitucional'],
      correctIndex: 0,
      explanation: 'Artículo 64.2 de la Constitución: corresponde al Presidente del Congreso refrendar la propuesta y el nombramiento del Presidente del Gobierno.'
    }
  },
  {
    keywords: ['silencio', 'administrativo', 'positivo', 'negativo', '24', '25', '39/2015'],
    title: 'Silencio Administrativo en la Ley 39/2015: Arts. 24 y 25',
    topic: 'Procedimiento Administrativo Común • Ley 39/2015',
    box1Label: '1. Solicitudes de Interesados (Art. 24)',
    box1Lines: [
      { text: '• REGLA GENERAL: SILENCIO POSITIVO (Estimatorio).', size: 16, color: '#047857', bold: true },
      { text: '• Naturaleza: Es un verdadero Acto Administrativo que finaliza el proceso.', size: 14, color: '#0f172a' },
      { text: '• Resolución tardía de la Administración: Sólo puede ser CONFIRMATORIA.', size: 14, color: '#1e3a8a', bold: true },
      { text: '• No se pueden adquirir por silencio facultades contrarias a la Ley.', size: 14, color: '#dc2626', bold: true }
    ],
    box2Label: '2. EXCEPCIONES: Silencio Negativo Tasado',
    box2Lines: [
      { text: '• 1. Norma con rango de Ley o Derecho de la Unión Europea.', size: 14, color: '#dc2626', bold: true },
      { text: '• 2. Derecho de Petición (Art. 29 CE).', size: 14, color: '#0f172a' },
      { text: '• 3. Transferencia de facultades sobre Dominio o Servicio Público.', size: 14, color: '#dc2626', bold: true },
      { text: '• 4. Actividades que puedan dañar el Medio Ambiente.', size: 14, color: '#0f172a' },
      { text: '• 5. Procedimientos de Responsabilidad Patrimonial.', size: 14, color: '#1e3a8a', bold: true }
    ],
    speech1: 'El silencio administrativo es una de las materias más preguntadas en las oposiciones de cualquier administración. En los procedimientos iniciados a solicitud del interesado, la regla general del artículo 24 es el silencio positivo. Tiene la consideración de acto administrativo finalizador del procedimiento.',
    speech2: 'Pero grabad a fuego las 5 excepciones donde el silencio es NEGATIVO: cuando lo establezca una norma con rango de Ley o de la Unión Europea, en el derecho de petición, en concesiones sobre dominio público o servicios públicos, en actividades lesivas para el medio ambiente y en responsabilidad patrimonial.',
    summaryRule: 'El silencio a solicitud de interesado es POSITIVO salvo Ley/UE, dominio público, medio ambiente, petición y responsabilidad patrimonial.',
    socratic: {
      prompt: 'Si un ciudadano solicita una indemnización por responsabilidad patrimonial y la Administración no contesta en plazo, el silencio es:',
      options: ['Desestimatorio (negativo)', 'Estimatorio (positivo)', 'Nulo de pleno derecho'],
      correctIndex: 0,
      hint: 'La responsabilidad patrimonial figura entre las 5 excepciones expresas del artículo 24.1 de la Ley 39/2015.',
      feedbackCorrect: '¡Exacto! El artículo 24.1 declara expresamente el silencio negativo para los expedientes de responsabilidad patrimonial de la Administración.',
      feedbackRetry: 'Recuerda: la responsabilidad patrimonial es una de las excepciones legales donde el silencio es desestimatorio.'
    },
    flashcards: [
      { front: '¿Qué naturaleza tiene el silencio positivo?', back: 'Tiene la consideración a todos los efectos de acto administrativo finalizador del procedimiento.' },
      { front: '¿Puede la Administración dictar resolución denegatoria tras un silencio positivo?', back: 'NO. Una vez producido el silencio positivo, la resolución expresa tardía sólo puede ser confirmatoria.' }
    ],
    quiz: {
      question: 'En un procedimiento iniciado de oficio susceptible de producir efectos desfavorables o de gravamen, la falta de resolución produce:',
      options: ['La caducidad del procedimiento', 'El silencio desestimatorio', 'El archivo voluntario'],
      correctIndex: 0,
      explanation: 'Artículo 25.1.b de la Ley 39/2015: si el procedimiento de oficio puede producir efectos desfavorables, el vencimiento del plazo sin resolución produce la caducidad.'
    }
  },
  {
    keywords: ['nulidad', 'anulabilidad', '47', '48', 'pleno derecho'],
    title: 'Nulidad de Pleno Derecho (Art. 47) vs Anulabilidad (Art. 48)',
    topic: 'Régimen de Invalidez de los Actos Administrativos',
    box1Label: '1. Nulidad de Pleno Derecho (Art. 47.1 Ley 39/2015)',
    box1Lines: [
      { text: '• Supuestos tasados de máxima gravedad (vicio insubsanable).', size: 15, color: '#dc2626', bold: true },
      { text: '• a) Lesionan derechos y libertades susceptibles de amparo.', size: 14, color: '#0f172a' },
      { text: '• b) Dictados por órgano manifiestamente incompetente (materia/territorio).', size: 14, color: '#0f172a' },
      { text: '• c) Contenido imposible o constitutivos de infracción penal.', size: 14, color: '#0f172a' },
      { text: '• d) Prescindiendo TOTAL y absolutamente del procedimiento legal.', size: 15, color: '#dc2626', bold: true }
    ],
    box2Label: '2. Anulabilidad y Convalidación (Art. 48 y 52)',
    box2Lines: [
      { text: '• REGLA GENERAL: Es anulable cualquier infracción del ordenamiento.', size: 15, color: '#1e3a8a', bold: true },
      { text: '• Los defectos de forma sólo causan anulabilidad si:', size: 14, color: '#0f172a' },
      { text: '  - Carecen de requisitos formales para alcanzar su fin, o', size: 14, color: '#334155' },
      { text: '  - Producen la INDEFENSIÓN de los interesados.', size: 15, color: '#dc2626', bold: true },
      { text: '• Subsanabilidad: El acto anulable SÍ puede ser convalidado.', size: 14, color: '#047857', bold: true }
    ],
    speech1: 'Vamos a dibujar en la pizarra la diferencia capital entre nulidad y anulabilidad. El artículo 47 recoge una lista tasada de nulidad de pleno derecho: son vicios de orden público que nunca prescriben y no pueden ser convalidados bajo ningún concepto.',
    speech2: 'Por contra, la anulabilidad del artículo 48 es la regla general para cualquier otra infracción de la ley. Además, los vicios de forma sólo anulan el acto si generan indefensión o impiden que alcance su fin, y el acto anulable puede convalidarse subsanando el vicio.',
    summaryRule: 'La nulidad es tasada, insubsanable e imprescriptible (Art. 47); la anulabilidad es la regla general, convalidable y prescribe (Art. 48).',
    socratic: {
      prompt: 'Un acto administrativo dictado con incompetencia jerárquica (no de materia ni de territorio): ¿es nulo o anulable?',
      options: ['Es anulable y puede ser convalidado por el superior', 'Es nulo de pleno derecho', 'Es válido de origen'],
      correctIndex: 0,
      hint: 'El artículo 47.1.b exige que la incompetencia sea manifiesta por razón de la materia o del territorio para ser nulo.',
      feedbackCorrect: '¡Exacto! La incompetencia jerárquica es causa de simple anulabilidad y el artículo 52.3 permite que sea convalidada por el órgano superior jerárquico.',
      feedbackRetry: 'Recuerda: sólo la incompetencia manifiesta por razón de la materia o del territorio causa nulidad radical.'
    },
    flashcards: [
      { front: '¿Puede convalidarse un acto nulo de pleno derecho?', back: 'NO, la nulidad radical es insubsanable e imprescriptible.' },
      { front: '¿Cuándo un defecto de forma produce la anulabilidad del acto?', back: 'Cuando carezca de los requisitos indispensables para alcanzar su fin o dé lugar a la indefensión de los interesados (Art. 48.2).' }
    ],
    quiz: {
      question: 'Los actos que prescindan total y absolutamente del procedimiento legalmente establecido son:',
      options: ['Nulos de pleno derecho', 'Anulables', 'Irregulares no invalidantes'],
      correctIndex: 0,
      explanation: 'Artículo 47.1.e de la Ley 39/2015: es causa tasada de nulidad radical de pleno derecho.'
    }
  },
  {
    keywords: ['recurso', 'alzada', 'reposicion', 'extraordinario', '121', '123', '125'],
    title: 'Recursos Administrativos en la Ley 39/2015: Alzada vs Reposición',
    topic: 'Procedimiento Administrativo • Título V Ley 39/2015',
    box1Label: '1. Recurso de Alzada (Arts. 121 y 122)',
    box1Lines: [
      { text: '• Contra actos que NO ponen fin a la vía administrativa.', size: 15, color: '#1e3a8a', bold: true },
      { text: '• Órgano: Se interpone ante el SUPERIOR JERÁRQUICO.', size: 15, color: '#0f172a', bold: true },
      { text: '• Plazo de interposición: 1 MES (acto expreso).', size: 16, color: '#dc2626', bold: true },
      { text: '• Plazo para resolver y notificar: 3 MESES (desestimatorio).', size: 15, color: '#047857', bold: true }
    ],
    box2Label: '2. Recurso de Reposición (Arts. 123 y 124)',
    box2Lines: [
      { text: '• Contra actos que SÍ ponen fin a la vía administrativa.', size: 15, color: '#dc2626', bold: true },
      { text: '• Carácter: POTESTATIVO (se puede acudir directo a lo Contencioso).', size: 15, color: '#047857', bold: true },
      { text: '• Órgano: Ante el MISMO órgano que dictó el acto.', size: 15, color: '#0f172a', bold: true },
      { text: '• Plazo de interposición: 1 MES / Plazo para resolver: 1 MES.', size: 16, color: '#1e3a8a', bold: true }
    ],
    speech1: 'Los recursos de alzada y reposición son la base del régimen impugnatorio administrativo. Si el acto no pone fin a la vía, interponemos obligatoriamente Alzada ante el superior jerárquico en el plazo de un mes.',
    speech2: 'Si el acto ya pone fin a la vía administrativa, la reposición es potestativa: el administrado elige si recurre ante el mismo órgano que dictó el acto en el plazo de un mes, o si va directamente a los juzgados de lo Contencioso-Administrativo.',
    summaryRule: 'Alzada: no agota vía, ante superior, 1 mes para interponer, 3 meses para resolver. Reposición: sí agota vía, mismo órgano, 1 mes/1 mes.',
    socratic: {
      prompt: 'Si interpongo recurso potestativo de reposición, ¿puedo acudir al juzgado contencioso-administrativo mientras esté pendiente de resolución?',
      options: [
        'No, hasta que sea resuelto expresamente o se produzca la desestimación por silencio',
        'Sí, en cualquier momento simultáneamente',
        'Sólo si se solicita autorización al juez'
      ],
      correctIndex: 0,
      hint: 'El artículo 123.2 prohíbe simultanear el recurso administrativo con el contencioso-administrativo.',
      feedbackCorrect: '¡Muy bien! Interpuesta la reposición, no se puede acudir a la vía judicial hasta que se resuelva expresamente o venza el mes del silencio.',
      feedbackRetry: 'Recuerda que no cabe duplicar la vía: hay que esperar la resolución expresa o el silencio del recurso de reposición.'
    },
    flashcards: [
      { front: '¿Cuál es el plazo para resolver el recurso de alzada?', back: '3 meses. Si transcurre sin resolución, se entiende desestimado salvo el caso del Art. 24.1 párrafo 3.' },
      { front: '¿Cuál es el plazo para resolver el recurso potestativo de reposición?', back: '1 mes.' }
    ],
    quiz: {
      question: 'El recurso de alzada se interpone contra actos que:',
      options: ['No ponen fin a la vía administrativa', 'Ponen fin a la vía administrativa', 'Son firmes en vía administrativa'],
      correctIndex: 0,
      explanation: 'Artículo 121.1 de la Ley 39/2015: cabe alzada contra resoluciones y actos de trámite cualificados que no pongan fin a la vía administrativa.'
    }
  },
  {
    keywords: ['balon', 'balón', 'parabólico', 'parabolico', 'curva', 'gravedad', 'proyectil'],
    title: 'Movimiento Parabólico: ¿Por qué un balón hace una curva?',
    topic: 'Física • Cinemática y Gravedad',
    box1Label: '1. Dos movimientos independientes a la vez',
    box1Lines: [
      { text: '• Horizontal (vx): Velocidad CONSTANTE (sin empuje tras el chute).', size: 15, color: '#2563eb', bold: true },
      { text: '• Vertical (vy): Solo tira la GRAVEDAD hacia abajo (g = 9.8 m/s²).', size: 15, color: '#dc2626', bold: true },
      { text: '• Experimento: Bola A (soltada) vs Bola B (lanzada de lado):', size: 15, color: '#0f172a', bold: true },
      { text: '  ✓ ¡Llegan al suelo EXACTAMENTE A LA VEZ!', size: 16, color: '#059669', bold: true }
    ],
    box2Label: '2. Conclusión Visual en la Pizarra',
    box2Lines: [
      { text: '• Al subir: la gravedad frena la componente vertical.', size: 15, color: '#0f172a' },
      { text: '• En el pico: velocidad vertical = 0 (sigue avanzando de lado).', size: 15, color: '#1e3a8a', bold: true },
      { text: '• Al caer: acelera hacia abajo manteniendo su avance lateral.', size: 15, color: '#0f172a' },
      { text: '• Más rápido de lado = cae más lejos, en el MISMO tiempo.', size: 15, color: '#dc2626', bold: true }
    ],
    speech1: '¡Gran pregunta! ¿Por qué un balón pateado hace una curva? Porque ocurren dos movimientos a la vez: hacia adelante va a velocidad constante porque tras la patada ya nada lo empuja, mientras que hacia abajo solo tira la gravedad.',
    speech2: 'Imagina dos bolas al borde de una mesa: A se deja caer y B se lanza de lado. Aunque parezca mentira, ¡llegan a la vez! La velocidad lateral solo hace que B caiga más lejos, pero tarda exactamente el mismo tiempo en tocar el suelo.',
    summaryRule: 'El movimiento parabólico combina avance horizontal constante con caída libre vertical: la gravedad manda en el tiempo de vuelo.',
    socratic: {
      prompt: 'Si A se deja caer y B se lanza horizontalmente desde la misma altura, ¿cuál llega antes al suelo?',
      options: ['Llegan exactamente a la vez', 'Llega antes A porque cae recto', 'Llega antes B porque lleva impulso'],
      correctIndex: 0,
      hint: 'El movimiento horizontal no afecta a la caída vertical provocada por la gravedad.',
      feedbackCorrect: '¡Exacto! Ambas tardan exactamente lo mismo en caer porque la gravedad actúa igual sobre las dos.',
      feedbackRetry: '¡Cuidado! La velocidad hacia los lados no frena la caída: las dos llegan a la vez.'
    },
    flashcards: [
      { front: 'Tras patear un balón, ¿qué fuerza lo empuja hacia adelante en el aire?', back: 'Ninguna (despreciando el aire): avanza por inercia a velocidad horizontal constante.' },
      { front: '¿Qué fuerza curva la trayectoria del balón hacia el suelo?', back: 'Únicamente la gravedad tirando hacia abajo.' }
    ],
    quiz: {
      question: 'En el punto más alto de una parábola, ¿cuál es la velocidad vertical del balón?',
      options: ['Cero (0 m/s)', 'Máxima', 'Igual a la horizontal'],
      correctIndex: 0,
      explanation: 'En la cima de la curva el balón deja de subir un instante (vy = 0) antes de empezar a bajar.'
    }
  },
  {
    keywords: ['interes', 'interés', 'compuesto', 'economía', 'economia', 'dinero'],
    title: 'Interés Compuesto: ¿Por qué crece tan rápido?',
    topic: 'Economía y Finanzas • Capitalización',
    box1Label: '1. Interés Simple vs Interés Compuesto',
    box1Lines: [
      { text: '• Interés SIMPLE: Solo ganas intereses sobre el capital inicial.', size: 15, color: '#475569', bold: true },
      { text: '  Ej: 1.000€ al 10% = +100€ cada año (línea recta).', size: 14, color: '#0f172a' },
      { text: '• Interés COMPUESTO: Los intereses generan NUEVOS intereses.', size: 15, color: '#2563eb', bold: true },
      { text: '  Año 1: 1.100€ | Año 2: 1.210€ | Año 10: 2.593€ (curva exponencial).', size: 14, color: '#059669', bold: true }
    ],
    box2Label: '2. Fórmula y Regla del 72',
    box2Lines: [
      { text: '• Fórmula: Capital Final = C₀ · (1 + r)ᵗ', size: 16, color: '#1e3a8a', bold: true },
      { text: '• La clave NO es solo el porcentaje, sino el TIEMPO (exponente t).', size: 15, color: '#dc2626', bold: true },
      { text: '• Truco mental (Regla del 72): 72 ÷ tasa% = años para DUPLICAR.', size: 15, color: '#047857', bold: true },
      { text: '  Al 8% anual, duplicas tu dinero cada 9 años (72 / 8 = 9).', size: 14, color: '#334155' }
    ],
    speech1: 'El interés compuesto crece tan rápido porque es como una bola de nieve: los intereses que ganas este año se suman al capital y el año siguiente también producen intereses. En el interés simple sumas siempre lo mismo; en el compuesto multiplicas.',
    speech2: 'Fíjate en la fórmula: el tiempo está en el exponente. Y recuerda la Regla del 72 para calcularlo de cabeza: divide 72 entre el porcentaje anual y sabrás en cuántos años se duplica el dinero.',
    summaryRule: 'El interés compuesto reinvierte las ganancias cada periodo: el tiempo en el exponente convierte un crecimiento lento en exponencial.',
    socratic: {
      prompt: 'Usando la Regla del 72, si inviertes a un 6% anual compuesto, ¿en cuántos años aproximados se duplicará tu dinero?',
      options: ['12 años (72 ÷ 6)', '6 años', '24 años'],
      correctIndex: 0,
      hint: 'Divide 72 entre la tasa de interés anual (6).',
      feedbackCorrect: '¡Correcto! 72 entre 6 son 12 años para duplicar el capital sin hacer cálculos complejos.',
      feedbackRetry: 'Aplica la Regla del 72: divide 72 entre 6.'
    },
    flashcards: [
      { front: '¿Qué diferencia al interés compuesto del simple?', back: 'Que los intereses generados se acumulan al capital para producir nuevos intereses.' },
      { front: '¿Para qué sirve la Regla del 72?', back: 'Para estimar cuántos años tarda en duplicarse una inversión dividiendo 72 entre el interés anual.' }
    ],
    quiz: {
      question: 'En la fórmula C = C₀ · (1 + r)ᵗ, ¿qué variable provoca el disparo exponencial a largo plazo?',
      options: ['El tiempo (t) en el exponente', 'El capital inicial', 'La resta lineal'],
      correctIndex: 0,
      explanation: 'Al estar el tiempo t como exponente, cada periodo multiplica el acumulado total.'
    }
  },
  {
    keywords: ['derivada', 'calculo', 'cálculo', 'pendiente', 'tangente'],
    title: '¿Qué es realmente una Derivada?',
    topic: 'Cálculo Diferencial • Matemáticas',
    box1Label: '1. La idea visual: Velocidad Instantánea',
    box1Lines: [
      { text: '• Pendiente media: Δy / Δx entre dos puntos separados.', size: 15, color: '#0f172a', bold: true },
      { text: '• ¿Qué pasa si acercas los dos puntos hasta Δx → 0?', size: 15, color: '#2563eb', bold: true },
      { text: '• La recta secante se convierte en la RECTA TANGENTE.', size: 15, color: '#dc2626', bold: true },
      { text: '• La derivada f\'(x) es la PENDIENTE exacta en ese instante.', size: 16, color: '#059669', bold: true }
    ],
    box2Label: '2. ¿Para qué sirve en la vida real?',
    box2Lines: [
      { text: '• Física: La derivada de la posición es la VELOCIDAD instantánea.', size: 15, color: '#1e3a8a', bold: true },
      { text: '• Optimización: Donde f\'(x) = 0 hay un MÁXIMO o un MÍNIMO.', size: 15, color: '#dc2626', bold: true },
      { text: '• Economía: Coste o beneficio marginal al producir 1 unidad más.', size: 14, color: '#334155' }
    ],
    speech1: 'Olvida por un segundo los límites complicados. Una derivada es simplemente la inclinación exacta de una curva en un punto concreto. Es pasar de saber tu velocidad media en un viaje a mirar el velocímetro en este preciso segundo.',
    speech2: 'Lo más útil de la derivada es encontrar máximos y mínimos: en la cima de una montaña o en el fondo de un valle, la pendiente es completamente plana, es decir, la derivada vale cero.',
    summaryRule: 'La derivada f\'(x) mide qué tan rápido cambia una función en un instante exacto: geométricamente es la pendiente de la recta tangente.',
    socratic: {
      prompt: 'En el punto más alto de una curva (un máximo local), ¿cuánto vale su derivada f\'(x)?',
      options: ['Cero (la tangente es horizontal)', 'Infinito', 'Negativa'],
      correctIndex: 0,
      hint: 'En la cima de la curva la recta tangente ni sube ni baja, está totalmente plana.',
      feedbackCorrect: '¡Exacto! Cuando una función alcanza un máximo o mínimo suave, su pendiente instantánea es 0.',
      feedbackRetry: 'Piensa en una montaña rusa justo arriba del todo: ni sube ni baja, la pendiente es 0.'
    },
    flashcards: [
      { front: 'Geométricamente, ¿qué representa la derivada f\'(a)?', back: 'La pendiente de la recta tangente a la curva en x = a.' },
      { front: 'Si la derivada es positiva en un tramo, ¿qué hace la función?', back: 'Está creciendo (subiendo).' }
    ],
    quiz: {
      question: 'La derivada de la posición respecto al tiempo representa:',
      options: ['La velocidad instantánea', 'La distancia total', 'La masa del objeto'],
      correctIndex: 0,
      explanation: 'Mide cuánto cambia la posición en un instante infinitesimal de tiempo.'
    }
  }
];

function createUniversalLessonFromTopic(
  query: string,
  mode: 'topic' | 'homework' | 'exam',
  teacherId: TeacherId,
  attachmentText?: string
): Lesson {
  const cleanQuery = query.trim() || 'Apuntes adjuntos';
  const lowerQuery = cleanQuery.toLowerCase();

  // If user uploaded notes/text without an API key, parse real sentences from the uploaded file!
  if (attachmentText && attachmentText.trim().length > 30) {
    const rawLines = attachmentText
      .split(/\r?\n|\.\s+/)
      .map(l => l.trim())
      .filter(l => l.length > 15 && l.length < 110)
      .slice(0, 8);

    const leftLines = rawLines.slice(0, 4);
    const rightLines = rawLines.slice(4, 8);

    const steps: LessonStep[] = [
      {
        id: 'att-1',
        title: '1. Puntos Clave de tus Apuntes',
        speech: `He leído el documento que has subido sobre "${cleanQuery}". Vamos a ir anotando en la pizarra las ideas principales que aparecen en tu texto para repasarlas paso a paso.`,
        writingFocusCoord: [250, 90],
        commands: [
          { id: 'a1-clear', type: 'clear' },
          {
            id: 'a1-title',
            type: 'title',
            text: cleanQuery.slice(0, 54),
            subtitle: `Repaso de tus apuntes adjuntos (${mode.toUpperCase()})`,
            x: 50,
            y: 40,
            color: '#1e3a8a',
          },
          {
            id: 'a1-box1',
            type: 'box',
            x: 50,
            y: 90,
            width: 430,
            height: 260,
            color: '#2563eb',
            label: '1. Ideas extraídas del texto',
          },
          ...leftLines.map((line, idx) => ({
            id: `a1-l-${idx}`,
            type: 'text' as const,
            text: `• ${line.slice(0, 56)}${line.length > 56 ? '...' : ''}`,
            x: 70,
            y: 135 + idx * 42,
            size: 14,
            color: '#0f172a',
            style: 'bold' as const,
          })),
          {
            id: 'a1-box2',
            type: 'box',
            x: 510,
            y: 90,
            width: 440,
            height: 260,
            color: '#059669',
            label: '2. Desarrollo y detalles clave',
          },
          ...(rightLines.length > 0
            ? rightLines
            : ['• Conecta una API Key gratuita (Gemini/Groq) para análisis profundo IA.']
          ).map((line, idx) => ({
            id: `a1-r-${idx}`,
            type: 'text' as const,
            text: `• ${line.slice(0, 56)}${line.length > 56 ? '...' : ''}`,
            x: 530,
            y: 135 + idx * 42,
            size: 14,
            color: '#0f172a',
            style: 'clean' as const,
          })),
        ],
      },
      {
        id: 'att-2',
        title: '2. Síntesis Final',
        speech:
          'Ya tienes el esquema de tus apuntes en la pizarra. Si quieres preguntarme cualquier duda sobre alguna frase concreta, escríbeme aquí en el chat o interrúmpeme.',
        writingFocusCoord: [500, 420],
        commands: [
          {
            id: 'a2-hl',
            type: 'highlight',
            x: 50,
            y: 380,
            width: 900,
            height: 70,
            color: 'rgba(254, 240, 138, 0.65)',
          },
          {
            id: 'a2-sum',
            type: 'text',
            text: `🎯 Resumen del documento: ${rawLines[0]?.slice(0, 78) || cleanQuery}`,
            x: 75,
            y: 422,
            size: 16,
            color: '#0f172a',
            style: 'bold',
          },
        ],
      },
    ];

    return {
      id: 'lesson-att-' + Date.now(),
      title: cleanQuery,
      topic: 'Apuntes Subidos',
      category: 'General',
      mode,
      teacherId,
      description: `Clase generada a partir de tus apuntes sobre ${cleanQuery}`,
      steps,
      flashcards: [
        {
          id: 'fc-att-1',
          front: `Idea principal de "${cleanQuery}"`,
          back: rawLines[0] || 'Revisa el esquema central dibujado en la pizarra.',
        },
      ],
      quiz: [
        {
          id: 'qz-att-1',
          question: `¿Qué punto aparece destacado en tus apuntes sobre "${cleanQuery}"?`,
          options: [
            rawLines[0]?.slice(0, 75) || 'Concepto principal del texto',
            'Ninguna de las anteriores',
          ],
          correctIndex: 0,
          explanation: 'Extraído directamente de los apuntes proporcionados.',
        },
      ],
    };
  }

  // Check if topic matches our rich knowledge base
  const matched = TOPIC_KNOWLEDGE_BASE.find(tk =>
    tk.keywords.some(k => lowerQuery.includes(k))
  );

  if (matched) {
    // Custom animated visual drawings for Physics / Economics / Calculus showcase topics
    const isPhysics = matched.keywords.includes('balon');
    const isCompound = matched.keywords.includes('interes');
    const isCalculus = matched.keywords.includes('derivada');

    if (isPhysics) {
      const steps: LessonStep[] = [
        {
          id: 'step-1',
          title: '1. Trayectoria y Fuerzas del Balón',
          speech: matched.speech1,
          writingFocusCoord: [300, 180],
          commands: [
            { id: 'p-clear', type: 'clear' },
            { id: 'p-title', type: 'title', text: matched.title, subtitle: matched.topic, x: 50, y: 40, color: '#1e3a8a' },
            // Ground line
            { id: 'p-ground', type: 'curve', points: [[60, 360], [920, 360]], color: '#64748b', lineWidth: 3 },
            // Ball at kick point
            { id: 'p-ball1', type: 'circle', x: 110, y: 342, radiusX: 16, color: '#0f172a' },
            // Parabolic curve
            {
              id: 'p-arc',
              type: 'curve',
              points: [[110, 342], [180, 220], [280, 145], [400, 125], [520, 155], [630, 240], [710, 342]],
              color: '#2563eb',
              lineWidth: 3.5,
              dashed: true,
              label: 'Curva parabólica',
            },
            // Velocity forward arrow (constant)
            { id: 'p-vx', type: 'arrow', from: [400, 125], to: [510, 125], color: '#059669', label: 'vx constante (sin empuje)' },
            // Gravity arrow down
            { id: 'p-g', type: 'arrow', from: [400, 125], to: [400, 220], color: '#dc2626', label: 'Gravedad ↓' },
          ],
          socratic: matched.socratic,
        },
        {
          id: 'step-2',
          title: '2. Experimento: Bola A vs Bola B',
          speech: matched.speech2,
          writingFocusCoord: [780, 200],
          commands: [
            // Cliff/table on the right
            { id: 'p-table', type: 'curve', points: [[740, 210], [800, 210], [800, 360]], color: '#334155', lineWidth: 3.5 },
            // Ball A falling straight
            { id: 'p-ballA', type: 'circle', x: 820, y: 200, radiusX: 10, color: '#2563eb' },
            { id: 'p-dropA', type: 'arrow', from: [820, 212], to: [820, 350], color: '#2563eb', label: 'A' },
            // Ball B thrown sideways
            { id: 'p-ballB', type: 'circle', x: 845, y: 200, radiusX: 10, color: '#dc2626' },
            { id: 'p-arcB', type: 'curve', points: [[845, 200], [890, 215], [930, 270], [955, 350]], color: '#dc2626', lineWidth: 2.5, dashed: true, label: 'B' },
            { id: 'p-same', type: 'text', text: '✓ A y B llegan AL MISMO TIEMPO', x: 520, y: 425, size: 20, color: '#059669', style: 'bold' },
            { id: 'p-sum', type: 'text', text: matched.summaryRule, x: 60, y: 480, size: 16, color: '#1e3a8a', style: 'bold' },
          ],
        },
      ];
      return {
        id: 'lesson-' + Date.now(),
        title: matched.title,
        topic: matched.topic,
        category: 'Física',
        mode,
        teacherId,
        description: matched.title,
        steps,
        flashcards: matched.flashcards.map((f, i) => ({ id: `fc-${i}`, ...f })),
        quiz: [{ id: 'qz-1', ...matched.quiz }],
      };
    }

    if (isCompound) {
      const steps: LessonStep[] = [
        {
          id: 'step-1',
          title: '1. Crecimiento Lineal vs Exponencial',
          speech: matched.speech1,
          writingFocusCoord: [300, 200],
          commands: [
            { id: 'e-clear', type: 'clear' },
            { id: 'e-title', type: 'title', text: matched.title, subtitle: matched.topic, x: 50, y: 40, color: '#1e3a8a' },
            // Axes
            { id: 'e-y', type: 'arrow', from: [110, 380], to: [110, 110], color: '#334155', label: 'Dinero (€)' },
            { id: 'e-x', type: 'arrow', from: [110, 380], to: [650, 380], color: '#334155', label: 'Tiempo (años)' },
            // Simple interest straight line
            { id: 'e-simple', type: 'curve', points: [[110, 350], [250, 325], [400, 300], [580, 270]], color: '#64748b', lineWidth: 3, dashed: true, label: 'Interés Simple (recta)' },
            // Compound interest exponential curve
            { id: 'e-comp', type: 'curve', points: [[110, 350], [220, 330], [340, 290], [450, 225], [540, 145], [590, 105]], color: '#059669', lineWidth: 4, label: 'Interés Compuesto (bola de nieve)' },
          ],
          socratic: matched.socratic,
        },
        {
          id: 'step-2',
          title: '2. Fórmula y Regla del 72',
          speech: matched.speech2,
          writingFocusCoord: [700, 220],
          commands: [
            { id: 'e-c1', type: 'circle', x: 790, y: 185, radiusX: 135, radiusY: 45, color: '#2563eb', label: 'C = C₀ · (1 + r)ᵗ' },
            { id: 'e-arr', type: 'arrow', from: [790, 232], to: [790, 290], color: '#dc2626', label: 'Exponente t' },
            { id: 'e-r72', type: 'text', text: 'Regla del 72: 72 ÷ tasa% = años para duplicar', x: 580, y: 330, size: 17, color: '#047857', style: 'bold' },
            { id: 'e-sum', type: 'text', text: `🎯 ${matched.summaryRule}`, x: 60, y: 450, size: 16, color: '#1e3a8a', style: 'bold' },
          ],
        },
      ];
      return {
        id: 'lesson-' + Date.now(),
        title: matched.title,
        topic: matched.topic,
        category: 'Matemáticas',
        mode,
        teacherId,
        description: matched.title,
        steps,
        flashcards: matched.flashcards.map((f, i) => ({ id: `fc-${i}`, ...f })),
        quiz: [{ id: 'qz-1', ...matched.quiz }],
      };
    }

    if (isCalculus) {
      const steps: LessonStep[] = [
        {
          id: 'step-1',
          title: '1. La Recta Tangente',
          speech: matched.speech1,
          writingFocusCoord: [300, 200],
          commands: [
            { id: 'd-clear', type: 'clear' },
            { id: 'd-title', type: 'title', text: matched.title, subtitle: matched.topic, x: 50, y: 40, color: '#1e3a8a' },
            { id: 'd-y', type: 'arrow', from: [120, 380], to: [120, 110], color: '#334155', label: 'f(x)' },
            { id: 'd-x', type: 'arrow', from: [120, 380], to: [640, 380], color: '#334155', label: 'x' },
            // Smooth curve
            { id: 'd-curve', type: 'curve', points: [[140, 350], [230, 320], [340, 250], [450, 150], [560, 110]], color: '#2563eb', lineWidth: 3.5, label: 'Curva f(x)' },
            // Point of tangency
            { id: 'd-pt', type: 'circle', x: 340, y: 250, radiusX: 8, color: '#dc2626' },
            // Tangent line
            { id: 'd-tan', type: 'curve', points: [[210, 345], [340, 250], [470, 155]], color: '#dc2626', lineWidth: 2.5, dashed: true, label: "Tangente = f'(x)" },
          ],
          socratic: matched.socratic,
        },
        {
          id: 'step-2',
          title: '2. Máximos y Mínimos (f\'(x) = 0)',
          speech: matched.speech2,
          writingFocusCoord: [750, 200],
          commands: [
            { id: 'd-hill', type: 'curve', points: [[660, 310], [720, 210], [780, 175], [840, 210], [900, 310]], color: '#059669', lineWidth: 3 },
            { id: 'd-top', type: 'circle', x: 780, y: 175, radiusX: 8, color: '#dc2626' },
            { id: 'd-flat', type: 'curve', points: [[710, 175], [850, 175]], color: '#dc2626', lineWidth: 2.5, label: "Pendiente = 0" },
            { id: 'd-sum', type: 'text', text: `🎯 ${matched.summaryRule}`, x: 60, y: 455, size: 16, color: '#1e3a8a', style: 'bold' },
          ],
        },
      ];
      return {
        id: 'lesson-' + Date.now(),
        title: matched.title,
        topic: matched.topic,
        category: 'Matemáticas',
        mode,
        teacherId,
        description: matched.title,
        steps,
        flashcards: matched.flashcards.map((f, i) => ({ id: `fc-${i}`, ...f })),
        quiz: [{ id: 'qz-1', ...matched.quiz }],
      };
    }

    // Visual hand-drawn node & arrow layout (no rigid boxes) for Law & Opposition topics
    const steps: LessonStep[] = [
      {
        id: 'step-1',
        title: '1. Mapa Visual y Claves',
        speech: matched.speech1,
        writingFocusCoord: [250, 90],
        commands: [
          { id: 'b1-clear', type: 'clear' },
          {
            id: 'b1-title',
            type: 'title',
            text: matched.title,
            subtitle: `${matched.topic}`,
            x: 50,
            y: 40,
            color: '#1e3a8a',
          },
          // Left hand-drawn node + underline
          { id: 'b1-node1', type: 'circle', x: 185, y: 112, radiusX: 135, radiusY: 22, color: '#2563eb' },
          { id: 'b1-lbl1', type: 'text', text: matched.box1Label, x: 70, y: 118, size: 15, color: '#1e3a8a', style: 'bold' },
          ...matched.box1Lines.map((line, idx) => ({
            id: `b1-line1-${idx}`,
            type: 'text' as const,
            text: line.text,
            x: 55,
            y: 162 + idx * 38,
            size: line.size,
            color: line.color,
            style: (line.bold ? 'bold' : 'clean') as any,
          })),
          // Connecting arrow from concept 1 to concept 2
          { id: 'b1-conn', type: 'arrow', from: [455, 112], to: [515, 112], color: '#dc2626' },
          // Right hand-drawn node
          { id: 'b1-node2', type: 'circle', x: 700, y: 112, radiusX: 165, radiusY: 22, color: '#dc2626' },
          { id: 'b1-lbl2', type: 'text', text: matched.box2Label, x: 555, y: 118, size: 15, color: '#b91c1c', style: 'bold' },
          ...matched.box2Lines.map((line, idx) => ({
            id: `b1-line2-${idx}`,
            type: 'text' as const,
            text: line.text,
            x: 525,
            y: 162 + idx * 38,
            size: line.size,
            color: line.color,
            style: (line.bold ? 'bold' : 'clean') as any,
          })),
        ],
        socratic: matched.socratic,
      },
      {
        id: 'step-2',
        title: '2. Regla Mnemotécnica de Examen',
        speech: matched.speech2,
        writingFocusCoord: [500, 420],
        commands: [
          {
            id: 'b2-highlight',
            type: 'highlight',
            x: 50,
            y: 385,
            width: 900,
            height: 60,
            color: 'rgba(254, 240, 138, 0.65)',
          },
          {
            id: 'b2-summary',
            type: 'text',
            text: `🎯 REGLA DE ORO: ${matched.summaryRule}`,
            x: 70,
            y: 422,
            size: 16,
            color: '#0f172a',
            style: 'bold',
          },
        ],
      },
    ];

    return {
      id: 'lesson-' + Date.now(),
      title: matched.title,
      topic: matched.topic,
      category: 'General',
      mode,
      teacherId,
      description: `Clase interactiva en pizarra sobre ${matched.title}`,
      steps,
      flashcards: matched.flashcards.map((f, i) => ({ id: `fc-${i}`, ...f })),
      quiz: [{ id: 'qz-1', ...matched.quiz }],
    };
  }

  // Fallback for general specific queries: build high-density concrete lesson
  const displayTitle = cleanQuery.length > 55 ? cleanQuery.slice(0, 52) + '...' : cleanQuery;
  const words = cleanQuery.split(/\s+/).filter(w => w.length > 3);
  const subjectName = words.slice(0, 4).join(' ') || cleanQuery;

  const steps: LessonStep[] = [
    {
      id: 'step-1',
      title: '1. Delimitación Positiva y Régimen Legal',
      speech: `¡Bienvenidos a la pizarra blanca! Vamos a estudiar con rigor "${cleanQuery}". En cualquier oposición o examen riguroso, lo primero es fijar con exactitud el régimen competencial, los plazos exigibles y las condiciones de validez jurídica.`,
      writingFocusCoord: [250, 90],
      commands: [
        { id: 'b1-clear', type: 'clear' },
        {
          id: 'b1-title',
          type: 'title',
          text: displayTitle.toUpperCase(),
          subtitle: `Régimen Jurídico y Esquema de Academia • ${subjectName}`,
          x: 50,
          y: 40,
          color: '#1e3a8a',
        },
        {
          id: 'b1-box1',
          type: 'box',
          x: 50,
          y: 90,
          width: 430,
          height: 250,
          color: '#2563eb',
          label: '1. Requisitos de Eficacia y Competencia',
        },
        {
          id: 'b1-t1',
          type: 'text',
          text: `• Materia regulada: ${subjectName}`,
          x: 70,
          y: 135,
          size: 16,
          color: '#0f172a',
          style: 'bold',
        },
        {
          id: 'b1-t2',
          type: 'text',
          text: `• Órgano Competente: Determinación expresa según la Ley.`,
          x: 70,
          y: 175,
          size: 15,
          color: '#1e3a8a',
          style: 'bold',
        },
        {
          id: 'b1-t3',
          type: 'text',
          text: `• Cómputo de Plazos: En días hábiles salvo disposición legal en contra.`,
          x: 70,
          y: 215,
          size: 14,
          color: '#334155',
        },
        {
          id: 'b1-t4',
          type: 'text',
          text: `• Notificación y Publicación: Requisito formal imprescindible de eficacia.`,
          x: 70,
          y: 255,
          size: 14,
          color: '#047857',
          style: 'bold',
        },
        {
          id: 'b1-box2',
          type: 'box',
          x: 510,
          y: 90,
          width: 440,
          height: 250,
          color: '#dc2626',
          label: '⚠️ Supuestos Especiales y Excepciones Tasadas',
        },
        {
          id: 'b1-t5',
          type: 'text',
          text: `• Supuesto A: Excepciones regladas frente al régimen general.`,
          x: 530,
          y: 135,
          size: 15,
          color: '#dc2626',
          style: 'bold',
        },
        {
          id: 'b1-t6',
          type: 'text',
          text: `• Supuesto B: Posible silencio administrativo aplicable.`,
          x: 530,
          y: 175,
          size: 14,
          color: '#0f172a',
          style: 'bold',
        },
        {
          id: 'b1-t7',
          type: 'text',
          text: `• Vía de Impugnación: Recursos administrativos procedentes y plazos.`,
          x: 530,
          y: 215,
          size: 14,
          color: '#334155',
        },
        {
          id: 'b1-t8',
          type: 'text',
          text: `• Trampa de Examen: Distinguir caducidad vs prescripción de acciones.`,
          x: 530,
          y: 255,
          size: 14,
          color: '#b91c1c',
          style: 'bold',
        },
      ],
      socratic: {
        prompt: `En el ámbito de "${subjectName}", ¿cuál es el error más recurrente que penalizan los tribunales?`,
        options: [
          'Confundir los plazos en días hábiles con días naturales o computar mal el día inicial',
          'Pensar que cualquier plazo administrativo admite prórrogas ilimitadas',
          'Interponer el recurso fuera de plazo sin agotar la vía previa requerida',
        ],
        correctIndex: 0,
        hint: 'El cómputo de plazos y la distinción entre días hábiles y naturales es el tema favorito de examen.',
        feedbackCorrect: '¡Exacto! El artículo 30 de la Ley 39/2015 excluye sábados, domingos y festivos salvo previsión legal expresa.',
        feedbackRetry: 'Recuerda: la trampa reina en las oposiciones es siempre el cómputo de plazos.',
      },
    },
    {
      id: 'step-2',
      title: '2. Claves Mnemotécnicas para el Día del Examen',
      speech:
        'Terminamos remarcando en la pizarra la regla de oro mnemotécnica. Si en el examen os aparece una pregunta sobre esta materia, revisad de inmediato el órgano, el plazo y si la norma prevé excepción.',
      writingFocusCoord: [500, 420],
      commands: [
        {
          id: 'b2-highlight',
          type: 'highlight',
          x: 50,
          y: 380,
          width: 900,
          height: 75,
          color: 'rgba(254, 240, 138, 0.65)',
        },
        {
          id: 'b2-summary',
          type: 'text',
          text: `🎯 CLAVE DE EXAMEN: Verificar siempre órgano competente, plazo exacto y si rige regla general o excepción en "${subjectName}".`,
          x: 75,
          y: 425,
          size: 15,
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
    description: `Clase didáctica en pizarra blanca sobre ${cleanQuery}`,
    steps,
    flashcards: [
      {
        id: 'fc-1',
        front: `¿Cuál es el marco competencial clave en "${subjectName}"?`,
        back: 'El órgano titular legalmente atribuido, sin posibilidad de alteración salvo delegación o avocación reglada.',
      },
      {
        id: 'fc-2',
        front: `¿Cómo computan con carácter general los plazos en "${subjectName}"?`,
        back: 'En días hábiles (excluyendo sábados, domingos y festivos) a partir del día siguiente a la notificación o publicación.',
      },
    ],
    quiz: [
      {
        id: 'qz-1',
        question: `Respecto a "${subjectName}", ¿qué elemento determina la eficacia frente a terceros?`,
        options: [
          'La correcta notificación o publicación reglamentaria',
          'La simple firma interna del funcionario',
          'La inclusión informal en el registro de entrada',
        ],
        correctIndex: 0,
        explanation: 'Los actos administrativos son eficaces desde la fecha en que se dictan, pero su eficacia queda demorada cuando lo exija el contenido del acto o esté supeditada a su notificación o publicación (Art. 39 Ley 39/2015).',
      },
    ],
  };
}

