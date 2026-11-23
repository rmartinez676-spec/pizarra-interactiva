export type BoardStyle = 'chalkboard' | 'whiteboard';

export type TeacherId = 'tomas' | 'clara' | 'nova' | 'valeria';

export interface Teacher {
  id: TeacherId;
  name: string;
  title: string;
  subject: string;
  avatarBg: string;
  accentColor: string;
  preferredBoard: BoardStyle;
  voiceGender: 'male' | 'female';
  voicePitch: number;
  voiceRate: number;
  tagline: string;
  personalityBio: string;
  greeting: string;
}

export type CommandType =
  | 'clear'
  | 'title'
  | 'text'
  | 'math'
  | 'box'
  | 'circle'
  | 'arrow'
  | 'graph'
  | 'diagram'
  | 'highlight'
  | 'table';

export interface BaseCommand {
  id: string;
  type: CommandType;
  color?: string;
}

export interface ClearCommand extends BaseCommand {
  type: 'clear';
}

export interface TitleCommand extends BaseCommand {
  type: 'title';
  text: string;
  subtitle?: string;
  x: number;
  y: number;
  underline?: boolean;
}

export interface TextCommand extends BaseCommand {
  type: 'text';
  text: string;
  x: number;
  y: number;
  size?: number;
  style?: 'hand' | 'clean' | 'bold';
}

export interface MathCommand extends BaseCommand {
  type: 'math';
  latex: string;
  x: number;
  y: number;
  label?: string;
  scale?: number;
}

export interface BoxCommand extends BaseCommand {
  type: 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  fill?: string;
  dashed?: boolean;
}

export interface CircleCommand extends BaseCommand {
  type: 'circle';
  x: number;
  y: number;
  radiusX: number;
  radiusY?: number;
  label?: string;
}

export interface ArrowCommand extends BaseCommand {
  type: 'arrow';
  from: [number, number];
  to: [number, number];
  label?: string;
  curve?: 'straight' | 'arc-up' | 'arc-down';
}

export interface GraphCommand extends BaseCommand {
  type: 'graph';
  x: number;
  y: number;
  width: number;
  height: number;
  equations: { fnName: string; expression: string; color: string; label?: string }[];
  xRange: [number, number];
  yRange: [number, number];
  title?: string;
  highlightPoints?: { x: number; y: number; label: string }[];
}

export interface DiagramCommand extends BaseCommand {
  type: 'diagram';
  kind: 'projectile' | 'photosynthesis' | 'secant_tangent' | 'punnett' | 'balance_scale';
  x: number;
  y: number;
  width: number;
  height: number;
  props?: Record<string, any>;
}

export interface HighlightCommand extends BaseCommand {
  type: 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface TableCommand extends BaseCommand {
  type: 'table';
  x: number;
  y: number;
  headers: string[];
  rows: string[][];
  width: number;
}

export type BoardCommand =
  | ClearCommand
  | TitleCommand
  | TextCommand
  | MathCommand
  | BoxCommand
  | CircleCommand
  | ArrowCommand
  | GraphCommand
  | DiagramCommand
  | HighlightCommand
  | TableCommand;

export interface SocraticCheck {
  prompt: string;
  options?: string[];
  correctIndex?: number;
  expectedKeywords?: string[];
  hint: string;
  feedbackCorrect: string;
  feedbackRetry: string;
}

export interface LessonStep {
  id: string;
  title: string;
  speech: string; // Spoken by teacher
  commands: BoardCommand[];
  socratic?: SocraticCheck;
  writingFocusCoord?: [number, number]; // Where the marker is currently writing
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  topic: string;
  category: 'Física' | 'Matemáticas' | 'Biología' | 'Química' | 'Programación' | 'General';
  mode: 'topic' | 'homework' | 'exam';
  teacherId: TeacherId;
  description: string;
  steps: LessonStep[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}
