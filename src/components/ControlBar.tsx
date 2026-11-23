import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Palette,
  Download,
  MessageCircleQuestion,
} from 'lucide-react';
import type { BoardStyle } from '../types';

interface ControlBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentStepIndex: number;
  totalSteps: number;
  onPrevStep: () => void;
  onNextStep: () => void;
  onReplayStep: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  boardStyle: BoardStyle;
  onToggleBoardStyle: () => void;
  onAskQuestion: () => void;
  onDownloadBoard: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  onTogglePlay,
  currentStepIndex,
  totalSteps,
  onPrevStep,
  onNextStep,
  onReplayStep,
  playbackSpeed,
  onChangeSpeed,
  isMuted,
  onToggleMute,
  boardStyle,
  onToggleBoardStyle,
  onAskQuestion,
  onDownloadBoard,
}) => {
  return (
    <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
      {/* Left: Playback controls */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={onPrevStep}
          disabled={currentStepIndex === 0}
          title="Paso anterior"
          className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-700/50 transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span className="text-xs md:text-sm">Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span className="text-xs md:text-sm">Explicar</span>
            </>
          )}
        </button>

        <button
          onClick={onNextStep}
          disabled={currentStepIndex >= totalSteps - 1}
          title="Siguiente paso"
          className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-700/50 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <button
          onClick={onReplayStep}
          title="Repetir este paso"
          className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Step dots / indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs font-medium text-slate-300">
          <span>
            Paso {currentStepIndex + 1} de {totalSteps}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStepIndex
                    ? 'bg-amber-400 w-4'
                    : i < currentStepIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Middle: Speed & Sound */}
      <div className="flex items-center gap-2">
        {/* Speed toggle */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-700/60 text-xs">
          {[1.0, 1.25, 1.5].map(spd => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                playbackSpeed === spd
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Mute button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Activar voz' : 'Silenciar voz'}
          className={`p-2 rounded-xl border transition-colors ${
            isMuted
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-400'
              : 'bg-slate-700/50 border-slate-600/50 text-emerald-400'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Right: Board style, Ask Question & Export */}
      <div className="flex items-center gap-2">
        {/* Whiteboard / Chalkboard switcher */}
        <button
          onClick={onToggleBoardStyle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-xs font-semibold text-slate-200 transition-colors"
          title="Cambiar estilo de pizarra"
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">
            {boardStyle === 'chalkboard' ? 'Pizarra Verde' : 'Pizarra Blanca'}
          </span>
        </button>

        {/* Ask doubt button */}
        <button
          onClick={onAskQuestion}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-400/40 text-xs font-semibold text-indigo-200 transition-colors"
        >
          <MessageCircleQuestion className="w-3.5 h-3.5 text-indigo-400" />
          <span>Tengo una duda</span>
        </button>

        {/* Download board */}
        <button
          onClick={onDownloadBoard}
          title="Descargar pizarra en PNG"
          className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
