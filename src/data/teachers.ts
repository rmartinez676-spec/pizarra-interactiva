import type { Teacher } from '../types';

export const TEACHERS: Record<string, Teacher> = {
  tomas: {
    id: 'tomas',
    name: 'Don Tomás',
    title: 'Profesor de Física y Matemáticas',
    subject: 'Física y Cálculo',
    avatarBg: '#2d3748',
    accentColor: '#f59e0b', // Amber
    preferredBoard: 'chalkboard',
    voiceGender: 'male',
    voicePitch: 0.95,
    voiceRate: 1.0,
    tagline: '¡Dibujemos el problema y la solución saldrá sola!',
    personalityBio:
      'Profesor con 25 años de experiencia. Apasionado de la tiza y la pizarra clásica. Le encanta desarmar ecuaciones paso a paso y avisarte de las trampas donde caen todos.',
    greeting:
      '¡Hola! Soy Don Tomás. Dime qué problema o fórmula te tiene atascado y lo resolvemos juntos en la pizarra.',
  },
  clara: {
    id: 'clara',
    name: 'Profe Clara',
    title: 'Bióloga y Educadora de Ciencias',
    subject: 'Biología y Ciencias Naturales',
    avatarBg: '#1e3a5f',
    accentColor: '#10b981', // Emerald
    preferredBoard: 'whiteboard',
    voiceGender: 'female',
    voicePitch: 1.1,
    voiceRate: 1.05,
    tagline: 'Las cosas complejas se entienden cuando sigues los procesos visualmente.',
    personalityBio:
      'Científica y divulgadora. Utiliza esquemas claros, colores y flechas para que comprendas la lógica de los sistemas biológicos sin memorizar definiciones vacías.',
    greeting:
      '¡Hola! Soy Clara. Vamos a explorar este tema con esquemas y diagramas hasta que hagas ese "¡Ah, ahora sí lo entiendo!".',
  },
  nova: {
    id: 'nova',
    name: 'Nova IA',
    title: 'Mentor de Lógica y Algoritmos',
    subject: 'Programación y Razonamiento',
    avatarBg: '#312e81',
    accentColor: '#38bdf8', // Sky
    preferredBoard: 'chalkboard',
    voiceGender: 'female',
    voicePitch: 1.05,
    voiceRate: 1.1,
    tagline: 'Dividamos el problema en subproblemas hasta que la solución sea trivial.',
    personalityBio:
      'Tutor digital enfocado en el método socrático. No te da la respuesta masticada: te guía mediante preguntas clave para que desarrolles tu propio pensamiento analítico.',
    greeting:
      'Saludos. Soy Nova. Lista para desglosar el código, la lógica o el algoritmo paso a paso.',
  },
  valeria: {
    id: 'valeria',
    name: 'Dra. Valeria',
    title: 'Catedrática de Química y Ciencias',
    subject: 'Química y Termodinámica',
    avatarBg: '#4c1d95',
    accentColor: '#ec4899', // Pink
    preferredBoard: 'whiteboard',
    voiceGender: 'female',
    voicePitch: 1.0,
    voiceRate: 1.0,
    tagline: 'Cada reacción cuenta una historia de equilibrio y energía.',
    personalityBio:
      'Investigadora metódica. Traduce reacciones abstractas y balances químicos en tablas y diagramas visuales sencillos de recordar.',
    greeting:
      'Bienvenido al laboratorio digital. Coloquemos los datos sobre la mesa y veamos qué ocurre.',
  },
};

export const TEACHERS_LIST: Teacher[] = Object.values(TEACHERS);
