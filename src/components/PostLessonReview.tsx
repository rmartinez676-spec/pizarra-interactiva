import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Layers, HelpCircle, CheckCircle2, RotateCcw, Trophy, Award } from 'lucide-react';
import type { Flashcard, QuizQuestion } from '../types';

interface PostLessonReviewProps {
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  onRestartLesson: () => void;
}

export const PostLessonReview: React.FC<PostLessonReviewProps> = ({
  flashcards,
  quiz,
  onRestartLesson,
}) => {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'quiz'>('flashcards');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const activeCard = flashcards[currentCardIndex];
  const activeQuizQ = quiz[currentQuizIndex];

  const handleQuizAnswer = (optionIdx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIdx);

    if (optionIdx === activeQuizQ.correctIndex) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    if (currentQuizIndex < quiz.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setQuizFinished(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            ¡Lección Completada! Asegura lo aprendido
          </h3>
          <p className="text-xs text-slate-400">
            Repasa con tarjetas activas o ponte a prueba con el test rápido
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'flashcards'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Flashcards ({flashcards.length})
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'quiz'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Test Rápido ({quiz.length})
          </button>
        </div>
      </div>

      {/* FLASHCARDS TAB */}
      {activeTab === 'flashcards' && activeCard && (
        <div className="py-6 max-w-xl mx-auto">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer min-h-[200px] p-6 rounded-2xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl flex flex-col items-center justify-center text-center transition-all transform hover:scale-[1.01]"
          >
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-3">
              {isFlipped ? 'Respuesta / Explicación' : 'Pregunta (Haz clic para voltear)'}
            </span>
            <p className="text-base md:text-lg text-slate-100 font-medium leading-relaxed">
              {isFlipped ? activeCard.back : activeCard.front}
            </p>
          </div>

          {/* Flashcard nav */}
          <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
            <button
              onClick={() => {
                setIsFlipped(false);
                setCurrentCardIndex(prev => Math.max(0, prev - 1));
              }}
              disabled={currentCardIndex === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Tarjeta {currentCardIndex + 1} de {flashcards.length}
            </span>
            <button
              onClick={() => {
                setIsFlipped(false);
                setCurrentCardIndex(prev => Math.min(flashcards.length - 1, prev + 1));
              }}
              disabled={currentCardIndex === flashcards.length - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* QUIZ TAB */}
      {activeTab === 'quiz' && (
        <div className="py-4 max-w-xl mx-auto">
          {!quizFinished && activeQuizQ ? (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>
                  Pregunta {currentQuizIndex + 1} de {quiz.length}
                </span>
                <span>Puntos: {quizScore}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-4 leading-relaxed">
                {activeQuizQ.question}
              </h4>

              <div className="space-y-2.5 mb-4">
                {activeQuizQ.options.map((opt, idx) => {
                  let style = 'bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-200';
                  if (selectedAnswer !== null) {
                    if (idx === activeQuizQ.correctIndex) {
                      style = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold';
                    } else if (idx === selectedAnswer) {
                      style = 'bg-rose-950/70 border-rose-500 text-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuizAnswer(idx)}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center justify-between ${style}`}
                    >
                      <span>{opt}</span>
                      {selectedAnswer !== null && idx === activeQuizQ.correctIndex && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedAnswer !== null && (
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 mb-4">
                  <span className="font-bold text-amber-400">Por qué: </span>
                  {activeQuizQ.explanation}
                </div>
              )}

              {selectedAnswer !== null && (
                <button
                  onClick={handleNextQuizQuestion}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-lg transition-transform active:scale-95"
                >
                  {currentQuizIndex < quiz.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultado Final'}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Award className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h4 className="text-xl font-bold text-slate-100 mb-1">¡Test Finalizado!</h4>
              <p className="text-slate-300 text-sm mb-6">
                Has acertado {quizScore} de {quiz.length} preguntas correctamente.
              </p>
              <button
                onClick={onRestartLesson}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-sm shadow-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Repasar lección desde el inicio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
