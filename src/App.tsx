import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Download,
  PlayCircle,
  Volume2,
} from 'lucide-react';
import type { Lesson, Teacher, TeacherId, BoardStyle } from './types';
import { TEACHERS } from './data/teachers';
import { PRESET_LESSONS } from './data/presetLessons';
import { speechService } from './services/speechService';
import { generateInteractiveLesson } from './services/aiGenerator';
import { Whiteboard } from './components/Whiteboard';
import { TeacherAvatar } from './components/TeacherAvatar';
import { ControlBar } from './components/ControlBar';
import { TeacherPicker } from './components/TeacherPicker';
import { SocraticModal } from './components/SocraticModal';
import { PostLessonReview } from './components/PostLessonReview';
import { AskModal } from './components/AskModal';

export function App() {
  // Active states
  const [currentLesson, setCurrentLesson] = useState<Lesson>(PRESET_LESSONS[0]);
  const [activeTeacher, setActiveTeacher] = useState<Teacher>(
    TEACHERS[PRESET_LESSONS[0].teacherId] || TEACHERS.tomas
  );
  const [boardStyle, setBoardStyle] = useState<BoardStyle>(
    activeTeacher.preferredBoard || 'chalkboard'
  );

  // Playback & Step states
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSocraticActive, setIsSocraticActive] = useState(false);
  const [isLessonFinished, setIsLessonFinished] = useState(false);

  // Modals
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);

  // Focus coordinate for hand pointer
  const [focusCoord, setFocusCoord] = useState<[number, number] | undefined>(undefined);

  const currentStep = currentLesson.steps[currentStepIndex] || currentLesson.steps[0];
  const stopSpeechRef = useRef<(() => void) | null>(null);

  // Sync teacher with lesson when lesson changes
  const switchLesson = (lesson: Lesson) => {
    stopSpeechRef.current?.();
    speechService.stop();
    setCurrentLesson(lesson);
    const teacher = TEACHERS[lesson.teacherId] || TEACHERS.tomas;
    setActiveTeacher(teacher);
    setBoardStyle(teacher.preferredBoard || 'chalkboard');
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setIsSpeaking(false);
    setIsWriting(false);
    setIsSocraticActive(false);
    setIsLessonFinished(false);
  };

  // Play / Speak active step
  const executeStep = (stepIndex: number, autoStartSpeech: boolean = true) => {
    const step = currentLesson.steps[stepIndex];
    if (!step) return;

    stopSpeechRef.current?.();
    speechService.stop();

    setFocusCoord(step.writingFocusCoord || [300, 150]);
    setIsWriting(true);

    if (autoStartSpeech) {
      setIsPlaying(true);
      const cancelSpeech = speechService.speak(
        step.speech,
        activeTeacher,
        playbackSpeed,
        {
          onStart: () => {
            setIsSpeaking(true);
            setIsWriting(true);
          },
          onEnd: () => {
            setIsSpeaking(false);
            setIsWriting(false);

            // Check if step has Socratic check
            if (step.socratic) {
              setIsSocraticActive(true);
              setIsPlaying(false);
            } else {
              // Auto advance if not last step
              if (stepIndex < currentLesson.steps.length - 1) {
                setTimeout(() => {
                  setCurrentStepIndex(stepIndex + 1);
                  executeStep(stepIndex + 1, true);
                }, 1200);
              } else {
                setIsPlaying(false);
                setIsLessonFinished(true);
              }
            }
          },
          onError: () => {
            setIsSpeaking(false);
            setIsWriting(false);
          },
        }
      );
      stopSpeechRef.current = cancelSpeech;
    }
  };

  // Handle Play/Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopSpeechRef.current?.();
      speechService.stop();
      setIsPlaying(false);
      setIsSpeaking(false);
      setIsWriting(false);
    } else {
      executeStep(currentStepIndex, true);
    }
  };

  // Handle Step change
  const handleNextStep = () => {
    if (currentStepIndex < currentLesson.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setIsSocraticActive(false);
      executeStep(nextIdx, isPlaying);
    } else {
      setIsLessonFinished(true);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      setIsSocraticActive(false);
      executeStep(prevIdx, isPlaying);
    }
  };

  const handleReplayStep = () => {
    setIsSocraticActive(false);
    executeStep(currentStepIndex, true);
  };

  // Handle Teacher change
  const handleSelectTeacher = (teacher: Teacher) => {
    setActiveTeacher(teacher);
    speechService.stop();
    setIsPlaying(false);
    setIsSpeaking(false);
    // Greet with teacher voice
    speechService.speak(teacher.greeting, teacher, playbackSpeed, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    speechService.setMuted(nextMuted);
  };

  // Speed change
  const handleChangeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (isPlaying) {
      executeStep(currentStepIndex, true);
    }
  };

  // Socratic passed
  const handleSocraticPassed = () => {
    setIsSocraticActive(false);
    if (currentStepIndex < currentLesson.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      executeStep(nextIdx, true);
    } else {
      setIsLessonFinished(true);
    }
  };

  // Submit custom query
  const handleQuerySubmit = async (query: string, mode: 'topic' | 'homework' | 'exam', teacherId?: TeacherId) => {
    setIsLoadingLesson(true);
    try {
      const newLesson = await generateInteractiveLesson({
        query,
        mode,
        teacherId: teacherId || activeTeacher.id,
      });
      setIsAskModalOpen(false);
      switchLesson(newLesson);
      // Auto-start after short delay
      setTimeout(() => {
        executeStep(0, true);
      }, 500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLesson(false);
    }
  };

  // Download Board as PNG
  const handleDownloadBoard = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${currentLesson.title.slice(0, 25)}_pizarra.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Gather all commands up to current step
  const accumulatedCommands = currentLesson.steps
    .slice(0, currentStepIndex + 1)
    .flatMap(s => s.commands);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-tight">
              Aha!
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-100 m-0">
                  AhaTutor
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  Pizarra Interactiva AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 m-0 hidden md:block">
                Profesores que dibujan y explican cada paso con voz en directo
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsAskModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs md:text-sm font-bold shadow-lg shadow-amber-400/20 transition-all transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Preguntar tema libre</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        {/* Preset Lessons Carousel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
              <BookOpen className="w-4 h-4 text-amber-400" /> Lecciones Demostrativas
            </span>
            <span>Elige un ejemplo o escribe tu propia pregunta</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESET_LESSONS.map(lesson => {
              const isActive = lesson.id === currentLesson.id;
              return (
                <button
                  key={lesson.id}
                  onClick={() => switchLesson(lesson)}
                  className={`text-left p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isActive
                      ? 'bg-slate-800 border-amber-400/90 shadow-lg shadow-amber-400/10 scale-[1.01]'
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {lesson.category}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {lesson.mode === 'homework' ? '📝 Tarea' : '🧠 Concepto'}
                      </span>
                    </div>
                    <h3 className="font-bold text-xs md:text-sm text-slate-100 line-clamp-2 leading-snug">
                      {lesson.title}
                    </h3>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Tutor: {TEACHERS[lesson.teacherId]?.name}
                    </span>
                    {isActive ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" /> En pizarra
                      </span>
                    ) : (
                      <span className="text-slate-500 hover:text-slate-300">Ver ➔</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson Header Banner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {currentLesson.topic}
              </span>
              <span className="text-xs text-slate-400">
                {currentLesson.steps.length} pasos pedagógicos
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-100 m-0">
              {currentLesson.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => executeStep(currentStepIndex, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Escuchar paso actual</span>
            </button>
            <button
              onClick={handleDownloadBoard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              title="Guardar imagen de la pizarra"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar Pizarra</span>
            </button>
          </div>
        </div>

        {/* Whiteboard Interactive Zone */}
        <div className="space-y-4">
          <Whiteboard
            boardStyle={boardStyle}
            commands={accumulatedCommands}
            activeTeacher={activeTeacher}
            isWriting={isWriting}
            focusCoord={focusCoord}
          />

          {/* Teacher Avatar & Real-time Speech Balloon */}
          <TeacherAvatar
            teacher={activeTeacher}
            isSpeaking={isSpeaking}
            currentSpeech={currentStep.speech}
          />

          {/* Socratic Checkpoint Modal (when active) */}
          {isSocraticActive && currentStep.socratic && (
            <SocraticModal
              socratic={currentStep.socratic}
              onPassed={handleSocraticPassed}
            />
          )}

          {/* Playback Controls */}
          <ControlBar
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            currentStepIndex={currentStepIndex}
            totalSteps={currentLesson.steps.length}
            onPrevStep={handlePrevStep}
            onNextStep={handleNextStep}
            onReplayStep={handleReplayStep}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={handleChangeSpeed}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            boardStyle={boardStyle}
            onToggleBoardStyle={() =>
              setBoardStyle(boardStyle === 'chalkboard' ? 'whiteboard' : 'chalkboard')
            }
            onAskQuestion={() => setIsAskModalOpen(true)}
            onDownloadBoard={handleDownloadBoard}
          />
        </div>

        {/* Teacher Picker Section */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <TeacherPicker
            selectedTeacherId={activeTeacher.id}
            onSelectTeacher={handleSelectTeacher}
          />
        </div>

        {/* Post-Lesson Review (Flashcards & Quiz) */}
        {(isLessonFinished || currentStepIndex === currentLesson.steps.length - 1) && (
          <PostLessonReview
            flashcards={currentLesson.flashcards}
            quiz={currentLesson.quiz}
            onRestartLesson={() => {
              setCurrentStepIndex(0);
              setIsLessonFinished(false);
              executeStep(0, true);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          AhaTutor • Inspirado en Ahaboard AI Whiteboard Tutor.
        </p>
      </footer>

      {/* Ask / Custom Query Modal */}
      <AskModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        onSubmit={handleQuerySubmit}
        isLoading={isLoadingLesson}
      />
    </div>
  );
}
