import React, { useState } from 'react';
import { HelpCircle, Lightbulb, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { SocraticCheck } from '../types';

interface SocraticModalProps {
  socratic: SocraticCheck;
  onPassed: () => void;
}

export const SocraticModal: React.FC<SocraticModalProps> = ({ socratic, onPassed }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const isCorrect = selectedOption === socratic.correctIndex;

  const handleSelect = (idx: number) => {
    if (hasSubmitted && isCorrect) return;
    setSelectedOption(idx);
    setHasSubmitted(true);
  };

  return (
    <div className="bg-slate-800/95 border-2 border-amber-400/80 backdrop-blur-xl rounded-2xl p-5 shadow-2xl animate-scaleUp">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-400">
            <HelpCircle className="w-5 h-5" />
          </span>
          <h3 className="font-bold text-base text-amber-300">
            Pausa Socrática: Tu turno de pensar
          </h3>
        </div>
        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30 transition-colors"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {showHint ? 'Ocultar pista' : 'Pedir pista'}
        </button>
      </div>

      {/* Prompt */}
      <p className="text-slate-100 font-medium text-sm md:text-base mb-4 leading-relaxed">
        {socratic.prompt}
      </p>

      {/* Optional Hint box */}
      {showHint && (
        <div className="mb-4 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>{socratic.hint}</span>
        </div>
      )}

      {/* Options */}
      {socratic.options && (
        <div className="space-y-2 mb-4">
          {socratic.options.map((opt, idx) => {
            let itemStyle = 'bg-slate-700/60 hover:bg-slate-700 border-slate-600 text-slate-200';
            if (hasSubmitted) {
              if (idx === socratic.correctIndex) {
                itemStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-semibold';
              } else if (idx === selectedOption) {
                itemStyle = 'bg-rose-950/70 border-rose-500 text-rose-200';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                className={`w-full text-left p-3 rounded-xl border text-sm transition-all duration-200 flex items-center justify-between ${itemStyle}`}
              >
                <span>{opt}</span>
                {hasSubmitted && idx === socratic.correctIndex && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
                {hasSubmitted && idx === selectedOption && idx !== socratic.correctIndex && (
                  <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback & Proceed Action */}
      {hasSubmitted && (
        <div className="pt-3 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs md:text-sm">
            {isCorrect ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 inline" /> {socratic.feedbackCorrect}
              </span>
            ) : (
              <span className="text-rose-400 font-medium flex items-center gap-1.5">
                <XCircle className="w-4 h-4 inline" /> {socratic.feedbackRetry}
              </span>
            )}
          </div>

          <button
            onClick={onPassed}
            className={`px-4 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              isCorrect
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {isCorrect ? 'Continuar lección' : 'Saltar y ver explicación'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
