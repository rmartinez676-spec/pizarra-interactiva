import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Paperclip,
  Volume2,
  VolumeX,
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Settings,
  BookOpen,
  X,
  Check,
  FileText,
} from 'lucide-react';
import type {
  AIConfig,
  BoardCommand,
  BoardStyle,
  ChatMessage,
  Lesson,
  Teacher,
  TeacherId,
} from './types';
import { TEACHERS, TEACHERS_LIST } from './data/teachers';
import { PRESET_LESSONS } from './data/presetLessons';
import { speechService } from './services/speechService';
import {
  answerStudentInterruption,
  generateInteractiveLesson,
} from './services/aiGenerator';
import { Whiteboard } from './components/Whiteboard';
import { LiveTutorChat } from './components/LiveTutorChat';
import { PostLessonReview } from './components/PostLessonReview';
import { AISettingsModal } from './components/AISettingsModal';

const QUICK_IDEAS = [
  { label: 'Física', query: '¿Por qué un balón pateado hace una curva?', mode: 'topic' as const },
  { label: 'Economía', query: '¿Por qué el interés compuesto crece tan rápido?', mode: 'topic' as const },
  { label: 'Cálculo', query: '¿Qué es realmente una derivada?', mode: 'topic' as const },
  { label: 'Oposiciones', query: 'Contratos Menores en la LCSP (Art. 118)', mode: 'exam' as const },
  { label: 'Constitución', query: 'La Corona y el Refrendo (Arts. 56 a 65 CE)', mode: 'exam' as const },
  { label: 'Ley 39/2015', query: 'Silencio Administrativo Positivo vs Negativo', mode: 'exam' as const },
  { label: 'Derecho', query: 'Nulidad (Art. 47) vs Anulabilidad (Art. 48)', mode: 'exam' as const },
];

export function App() {
  // Navigation View: 'home' (Ahaboard prompt landing) or 'classroom' (live split whiteboard)
  const [view, setView] = useState<'home' | 'classroom'>('home');

  // Home Prompt States
  const [queryInput, setQueryInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'topic' | 'exam' | 'homework'>('topic');
  const [activeTeacher, setActiveTeacher] = useState<Teacher>(
    TEACHERS.javier || Object.values(TEACHERS)[0]
  );
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Config (saved in localStorage)
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const saved = localStorage.getItem('ahaboard_ai_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { provider: 'gemini', apiKey: '' };
  });
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);

  // Audio & Classroom States
  const [audioTested, setAudioTested] = useState(false);
  const [boardStyle, setBoardStyle] = useState<BoardStyle>('whiteboard');
  const [currentLesson, setCurrentLesson] = useState<Lesson>(PRESET_LESSONS[0]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [extraCommands, setExtraCommands] = useState<BoardCommand[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isWaitingForSocratic, setIsWaitingForSocratic] = useState(false);
  const [isLessonFinished, setIsLessonFinished] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  // Live 1-on-1 Chat Thread
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const stopSpeechRef = useRef<(() => void) | null>(null);
  const stepTimerRef = useRef<number | null>(null);

  const currentStep = currentLesson.steps[currentStepIndex] || currentLesson.steps[0];

  const handleSaveAIConfig = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('ahaboard_ai_config', JSON.stringify(newConfig));
    } catch {}
  };

  const handleTestAudio = () => {
    speechService.unlockAudio();
    speechService.testAudioSound(() => {
      setAudioTested(true);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setAttachedFile({
        name: file.name,
        content: text || `Archivo adjunto: ${file.name}`,
      });
      if (!queryInput.trim()) {
        setQueryInput(`Explícame mis apuntes de ${file.name.replace(/\.[^.]+$/, '')}`);
      }
    };
    reader.readAsText(file);
  };

  const clearTimersAndSpeech = () => {
    if (stepTimerRef.current) {
      window.clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    stopSpeechRef.current?.();
    speechService.stop();
  };

  // Run a specific step in the classroom (draws + speaks + posts to chat)
  const executeStep = (lesson: Lesson, stepIndex: number, autoPlay: boolean = true) => {
    const step = lesson.steps[stepIndex];
    if (!step) return;

    clearTimersAndSpeech();
    setCurrentStepIndex(stepIndex);
    setIsWaitingForSocratic(false);
    setIsWriting(true);

    // Append teacher message to chat if not already the last message
    setChatMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.sender === 'teacher' && last.text === step.speech) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `msg-${step.id}-${Date.now()}`,
          sender: 'teacher',
          text: step.speech,
          timestamp: Date.now(),
        },
      ];
    });

    if (!autoPlay) {
      setIsPlaying(false);
      setIsSpeaking(false);
      return;
    }

    setIsPlaying(true);
    const teacher = TEACHERS[lesson.teacherId] || activeTeacher;
    const cancel = speechService.speak(step.speech, teacher, playbackSpeed, {
      onStart: () => {
        setIsSpeaking(true);
        setIsWriting(true);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setIsWriting(false);

        if (step.socratic) {
          setIsWaitingForSocratic(true);
          setIsPlaying(false);
          setChatMessages(prev => [
            ...prev,
            {
              id: `soc-${step.id}-${Date.now()}`,
              sender: 'teacher',
              text: step.socratic!.prompt,
              timestamp: Date.now(),
              isQuestion: true,
            },
          ]);
        } else if (stepIndex < lesson.steps.length - 1) {
          stepTimerRef.current = window.setTimeout(() => {
            executeStep(lesson, stepIndex + 1, true);
          }, 900);
        } else {
          setIsPlaying(false);
          setIsLessonFinished(true);
          setChatMessages(prev => [
            ...prev,
            {
              id: `done-${Date.now()}`,
              sender: 'system',
              text: 'Clase completada. Puedes preguntar cualquier duda o abrir el cuestionario rápido.',
              timestamp: Date.now(),
            },
          ]);
        }
      },
      onError: () => {
        setIsSpeaking(false);
        setIsWriting(false);
      },
    });
    stopSpeechRef.current = cancel;
  };

  // Start a new class from Home or Quick Idea
  const startLesson = async (
    customQuery?: string,
    customMode?: 'topic' | 'exam' | 'homework'
  ) => {
    const q = (customQuery ?? queryInput).trim();
    if (!q && !attachedFile) return;

    // Crucial: unlock browser audio synchronously inside the click handler!
    speechService.unlockAudio();

    const modeToUse = customMode ?? selectedMode;
    setIsLoadingLesson(true);

    try {
      const lesson = await generateInteractiveLesson({
        query: q || attachedFile?.name || 'Tema de estudio',
        mode: modeToUse,
        teacherId: activeTeacher.id as TeacherId,
        apiKey: aiConfig.apiKey,
        provider: aiConfig.provider,
        attachmentText: attachedFile?.content,
      });

      clearTimersAndSpeech();
      setCurrentLesson(lesson);
      setExtraCommands([]);
      setIsLessonFinished(false);
      setShowReviewModal(false);
      setChatMessages([
        {
          id: `sys-start-${Date.now()}`,
          sender: 'system',
          text: `${activeTeacher.name} ha abierto la pizarra · Modo ${
            modeToUse === 'exam' ? 'Examen' : modeToUse === 'homework' ? 'Tarea' : 'Tema'
          }`,
          timestamp: Date.now(),
        },
      ]);
      setView('classroom');

      // Start step 0 immediately
      executeStep(lesson, 0, true);
    } catch (e) {
      console.error('Error starting lesson:', e);
    } finally {
      setIsLoadingLesson(false);
    }
  };

  // Handle Student Interruption or Chat Reply
  const handleStudentMessage = async (text: string) => {
    speechService.unlockAudio();
    clearTimersAndSpeech();
    setIsPlaying(false);
    setIsSpeaking(false);

    setChatMessages(prev => [
      ...prev,
      {
        id: `stu-${Date.now()}`,
        sender: 'student',
        text,
        timestamp: Date.now(),
      },
    ]);

    // If tutor was waiting for a Socratic answer, check if they answered via text
    if (isWaitingForSocratic && currentStep.socratic) {
      const socratic = currentStep.socratic;
      const lower = text.toLowerCase();
      const correctOpt = socratic.options?.[socratic.correctIndex ?? 0]?.toLowerCase() || '';
      const isLikelyCorrect =
        (correctOpt && lower.includes(correctOpt.slice(0, 12))) ||
        lower.includes('a la vez') ||
        lower.includes('mismo tiempo') ||
        lower.includes('congreso') ||
        lower.includes('cero');

      if (isLikelyCorrect) {
        handleSocraticOption(socratic.correctIndex ?? 0, text, true);
        return;
      }
    }

    setIsGeneratingReply(true);
    try {
      const reply = await answerStudentInterruption({
        question: text,
        lessonTitle: currentLesson.title,
        currentStepTitle: currentStep.title,
        currentSpeech: currentStep.speech,
        apiKey: aiConfig.apiKey,
        provider: aiConfig.provider,
      });

      setExtraCommands(prev => [...prev, ...reply.commands]);
      setChatMessages(prev => [
        ...prev,
        {
          id: `rep-${Date.now()}`,
          sender: 'teacher',
          text: reply.speech,
          timestamp: Date.now(),
        },
      ]);

      setIsWriting(true);
      const cancel = speechService.speak(reply.speech, activeTeacher, playbackSpeed, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          setIsWriting(false);
        },
      });
      stopSpeechRef.current = cancel;
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSocraticOption = (index: number, optionText: string, skipUserBubble = false) => {
    speechService.unlockAudio();
    const socratic = currentStep.socratic;
    if (!socratic) return;

    if (!skipUserBubble) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `stu-opt-${Date.now()}`,
          sender: 'student',
          text: optionText,
          timestamp: Date.now(),
        },
      ]);
    }

    const isCorrect = index === socratic.correctIndex;
    const feedback = isCorrect ? socratic.feedbackCorrect : socratic.feedbackRetry;

    setChatMessages(prev => [
      ...prev,
      {
        id: `fb-${Date.now()}`,
        sender: 'teacher',
        text: feedback,
        timestamp: Date.now(),
      },
    ]);

    if (isCorrect) {
      setIsWaitingForSocratic(false);
      const cancel = speechService.speak(feedback, activeTeacher, playbackSpeed, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          if (currentStepIndex < currentLesson.steps.length - 1) {
            stepTimerRef.current = window.setTimeout(() => {
              executeStep(currentLesson, currentStepIndex + 1, true);
            }, 800);
          } else {
            setIsLessonFinished(true);
          }
        },
      });
      stopSpeechRef.current = cancel;
    } else {
      const cancel = speechService.speak(feedback, activeTeacher, playbackSpeed, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
      stopSpeechRef.current = cancel;
    }
  };

  const handleTogglePlay = () => {
    speechService.unlockAudio();
    if (isPlaying) {
      clearTimersAndSpeech();
      setIsPlaying(false);
      setIsSpeaking(false);
      setIsWriting(false);
    } else {
      executeStep(currentLesson, currentStepIndex, true);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    speechService.setMuted(next);
  };

  useEffect(() => {
    return () => {
      clearTimersAndSpeech();
    };
  }, []);

  const accumulatedCommands = [
    ...currentLesson.steps.slice(0, currentStepIndex + 1).flatMap(s => s.commands),
    ...extraCommands,
  ];

  // ============================================================================
  // VIEW 1: HOME (Ahaboard.ai/es Style Clean Landing & Prompt)
  // ============================================================================
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
        {/* Clean Minimal Navbar */}
        <header className="w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-600/20">
              aha
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              ahaboard <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-1">ES</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestAudio}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                audioTested
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{audioTested ? 'Voz lista ✓' : 'Probar voz'}</span>
            </button>

            <button
              onClick={() => setIsAISettingsOpen(true)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                aiConfig.apiKey
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{aiConfig.apiKey ? `IA: ${aiConfig.provider.toUpperCase()}` : 'Conectar IA'}</span>
            </button>
          </div>
        </header>

        {/* Centered Hero + Prompt Box */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-3xl mx-auto w-full">
          <div className="text-center space-y-3 mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              ¿Te atascas? <span className="text-indigo-600">Te lo dibuja.</span>
            </h1>
            <p className="text-base md:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
              Tu tutor de IA con pizarra. Escribe una pregunta, tema de oposición o sube tus apuntes: te lo explica en voz alta y dibuja cada paso.
            </p>
          </div>

          {/* Main Ahaboard Card */}
          <div className="w-full bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/60 p-4 md:p-5 space-y-4">
            {/* Mode Tabs: Tema | Examen | Tarea */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                {(
                  [
                    { id: 'topic', label: 'Tema' },
                    { id: 'exam', label: 'Examen' },
                    { id: 'homework', label: 'Tarea' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMode(tab.id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedMode === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                {selectedMode === 'topic' && 'Explicación visual paso a paso'}
                {selectedMode === 'exam' && 'Puntos clave, trampas y cuestionario'}
                {selectedMode === 'homework' && 'Pistas guiadas sin darte la respuesta'}
              </span>
            </div>

            {/* Prompt Textarea */}
            <textarea
              rows={3}
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startLesson();
                }
              }}
              placeholder="Escribe cualquier duda o tema... Ej: ¿Por qué un balón pateado hace una curva? o Contratos Menores Art. 118 LCSP"
              className="w-full resize-none bg-transparent text-base md:text-lg text-slate-900 placeholder-slate-400 focus:outline-none leading-relaxed"
            />

            {/* Attached File Chip */}
            {attachedFile && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>{attachedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="hover:text-indigo-950"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Teacher Selector Row (Compact) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Elige tu profesor:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEACHERS_LIST.map(t => {
                  const isSelected = t.id === activeTeacher.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTeacher(t)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: t.accentColor }}
                      >
                        {t.name.split(' ')[1]?.[0] || t.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{t.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{t.subject}</div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                  <span>Agregar apuntes (.txt/.md)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => startLesson()}
                disabled={(!queryInput.trim() && !attachedFile) || isLoadingLesson}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isLoadingLesson ? 'Preparando pizarra...' : 'Empezar'}</span>
              </button>
            </div>
          </div>

          {/* Quick Ideas */}
          <div className="mt-8 w-full space-y-2.5 text-center">
            <p className="text-xs font-semibold text-slate-400">
              o prueba con una de estas ideas:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUICK_IDEAS.map((idea, i) => (
                <button
                  key={i}
                  onClick={() => startLesson(idea.query, idea.mode)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs text-slate-700 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <span className="font-bold text-indigo-600">{idea.label}</span>
                  <span>{idea.query}</span>
                </button>
              ))}
            </div>
          </div>
        </main>

        <AISettingsModal
          isOpen={isAISettingsOpen}
          onClose={() => setIsAISettingsOpen(false)}
          config={aiConfig}
          onSave={handleSaveAIConfig}
        />
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: CLASSROOM (Live Whiteboard + 1-on-1 Chat Split View)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Compact Classroom Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                clearTimersAndSpeech();
                setView('home');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Nueva clase</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-extrabold text-slate-900 truncate m-0">
                  {currentLesson.title}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 flex-shrink-0">
                  {currentLesson.mode === 'exam'
                    ? 'Examen'
                    : currentLesson.mode === 'homework'
                    ? 'Tarea'
                    : 'Tema'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                isMuted
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title={isMuted ? 'Activar voz' : 'Silenciar voz'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsAISettingsOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hidden sm:flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{aiConfig.apiKey ? 'IA Conectada' : 'Conectar IA'}</span>
            </button>

            <button
              onClick={() => setShowReviewModal(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Apuntes y Quiz</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Classroom */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* LEFT: Live Animated Whiteboard + Compact Playback Controls */}
        <div className="space-y-3">
          <Whiteboard
            boardStyle={boardStyle}
            commands={accumulatedCommands}
            activeTeacher={activeTeacher}
            isWriting={isWriting}
            focusCoord={currentStep.writingFocusCoord}
          />

          {/* Compact Playback & Speed Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pausar' : 'Continuar'}</span>
              </button>

              <button
                onClick={() => {
                  if (currentStepIndex > 0) executeStep(currentLesson, currentStepIndex - 1, true);
                }}
                disabled={currentStepIndex === 0}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
                title="Paso anterior"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold text-slate-600 px-1">
                Paso {currentStepIndex + 1} / {currentLesson.steps.length}
              </span>

              <button
                onClick={() => {
                  if (currentStepIndex < currentLesson.steps.length - 1) {
                    executeStep(currentLesson, currentStepIndex + 1, true);
                  }
                }}
                disabled={currentStepIndex >= currentLesson.steps.length - 1}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
                title="Siguiente paso"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => executeStep(currentLesson, currentStepIndex, true)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                title="Repetir este paso"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                {[1, 1.25, 1.5].map(spd => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      playbackSpeed === spd
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  setBoardStyle(boardStyle === 'whiteboard' ? 'chalkboard' : 'whiteboard')
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
              >
                {boardStyle === 'whiteboard' ? 'Pizarra Verde' : 'Pizarra Blanca'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: 1-on-1 Live Tutor Conversation */}
        <div className="lg:sticky lg:top-16">
          <LiveTutorChat
            teacher={activeTeacher}
            isSpeaking={isSpeaking}
            isWriting={isWriting}
            messages={chatMessages}
            activeSocratic={currentStep.socratic}
            isWaitingForSocratic={isWaitingForSocratic}
            onSendMessage={handleStudentMessage}
            onAnswerSocraticOption={(idx, text) => handleSocraticOption(idx, text)}
            onReplayAudio={() => executeStep(currentLesson, currentStepIndex, true)}
            isGeneratingReply={isGeneratingReply}
          />
        </div>
      </main>

      {/* Post-Lesson Flashcards & Quiz Modal */}
      {(showReviewModal || isLessonFinished) && showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full relative">
            <button
              onClick={() => setShowReviewModal(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
            <PostLessonReview
              flashcards={currentLesson.flashcards}
              quiz={currentLesson.quiz}
              onRestartLesson={() => {
                setShowReviewModal(false);
                setExtraCommands([]);
                setIsLessonFinished(false);
                executeStep(currentLesson, 0, true);
              }}
            />
          </div>
        </div>
      )}

      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        config={aiConfig}
        onSave={handleSaveAIConfig}
      />
    </div>
  );
}
