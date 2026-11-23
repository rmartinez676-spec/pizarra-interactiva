import React, { useState } from 'react';
import { X, Sparkles, BookOpen, PenTool, GraduationCap } from 'lucide-react';
import type { TeacherId } from '../types';

interface AskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (query: string, mode: 'topic' | 'homework' | 'exam', teacherId?: TeacherId) => void;
  isLoading: boolean;
}

export const AskModal: React.FC<AskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'topic' | 'homework' | 'exam'>('topic');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit(query.trim(), mode);
  };

  const sampleIdeas = [
    { title: '¿Por qué la luna tiene fases?', mode: 'topic' as const },
    { title: 'Resolver: 2(x + 4) = 18 paso a paso', mode: 'homework' as const },
    { title: '¿Por qué los barcos de hierro flotan?', mode: 'topic' as const },
    { title: 'Repaso rápido: Leyes de Newton y trampas de examen', mode: 'exam' as const },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative animate-scaleUp">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-100">
            Pregúntale a tu Profesor(a)
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Escribe tu duda, problema de tarea o tema y el profesor lo explicará dibujando en la pizarra.
        </p>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('topic')}
            className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
              mode === 'topic'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Concepto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('homework')}
            className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
              mode === 'homework'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Modo Tarea</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('exam')}
            className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
              mode === 'exam'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Repaso Examen</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ejemplo: ¿Por qué la derivada de x² es 2x? o pega aquí el enunciado de tu ejercicio..."
              rows={3}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-sans"
            />
          </div>

          {/* Quick Idea Pills */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              O prueba una de estas ideas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleIdeas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(idea.title);
                    setMode(idea.mode);
                  }}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 rounded-lg px-2.5 py-1 transition-colors text-left"
                >
                  {idea.title}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-40"
            >
              {isLoading ? 'Preparando la pizarra...' : 'Comenzar Lección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
