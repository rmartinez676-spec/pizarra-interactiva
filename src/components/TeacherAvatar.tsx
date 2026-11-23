import React from 'react';
import type { Teacher } from '../types';

interface TeacherAvatarProps {
  teacher: Teacher;
  isSpeaking: boolean;
  currentSpeech?: string;
  className?: string;
}

export const TeacherAvatar: React.FC<TeacherAvatarProps> = ({
  teacher,
  isSpeaking,
  currentSpeech,
  className = '',
}) => {
  return (
    <div className={`flex items-start gap-4 ${className}`}>
      {/* Avatar Card */}
      <div className="relative flex-shrink-0 group">
        <div
          className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-xl border-2 transition-all duration-300 flex items-center justify-center ${
            isSpeaking ? 'ring-4 ring-amber-400/50 scale-105' : ''
          }`}
          style={{
            backgroundColor: teacher.avatarBg,
            borderColor: teacher.accentColor,
          }}
        >
          {/* Custom SVG Characters */}
          {teacher.id === 'tomas' && (
            <svg
              className={`w-full h-full transform transition-transform duration-200 ${
                isSpeaking ? 'translate-y-0.5' : ''
              }`}
              viewBox="0 0 100 100"
            >
              {/* Suit / Sweater */}
              <circle cx="50" cy="115" r="50" fill="#78350f" />
              <path d="M 42 68 L 50 82 L 58 68 Z" fill="#f59e0b" />
              {/* Head */}
              <circle cx="50" cy="48" r="24" fill="#fed7aa" />
              {/* Hair */}
              <path
                d="M 26 44 C 26 28 74 28 74 44 C 74 34 68 24 50 24 C 32 24 26 34 26 44 Z"
                fill="#cbd5e1"
              />
              {/* Glasses */}
              <rect
                x="34"
                y="40"
                width="13"
                height="9"
                rx="2"
                fill="none"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
              <rect
                x="53"
                y="40"
                width="13"
                height="9"
                rx="2"
                fill="none"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
              <line
                x1="47"
                y1="44"
                x2="53"
                y2="44"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
              {/* Eyes */}
              <circle cx="40.5" cy="44.5" r="2" fill="#0f172a" />
              <circle cx="59.5" cy="44.5" r="2" fill="#0f172a" />
              {/* Mustache */}
              <path
                d="M 40 56 Q 50 51 60 56 Q 50 60 40 56"
                fill="#94a3b8"
              />
              {/* Mouth */}
              {isSpeaking ? (
                <ellipse
                  cx="50"
                  cy="60"
                  rx="4"
                  ry="3.5"
                  fill="#991b1b"
                  className="animate-pulse"
                />
              ) : (
                <path
                  d="M 46 60 Q 50 62 54 60"
                  stroke="#991b1b"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}

          {teacher.id === 'clara' && (
            <svg
              className={`w-full h-full transform transition-transform duration-200 ${
                isSpeaking ? 'translate-y-0.5' : ''
              }`}
              viewBox="0 0 100 100"
            >
              {/* Blouse */}
              <circle cx="50" cy="115" r="50" fill="#065f46" />
              {/* Head */}
              <circle cx="50" cy="48" r="23" fill="#fde68a" />
              {/* Hair */}
              <path
                d="M 24 50 C 22 28 78 28 76 50 C 80 62 76 74 72 74 C 70 54 70 38 50 34 C 30 38 30 54 28 74 C 24 74 20 62 24 50 Z"
                fill="#78350f"
              />
              {/* Eyes */}
              <ellipse cx="41" cy="46" rx="2.5" ry="3.5" fill="#1e293b" />
              <ellipse cx="59" cy="46" rx="2.5" ry="3.5" fill="#1e293b" />
              <circle cx="42" cy="44.5" r="1" fill="#ffffff" />
              <circle cx="60" cy="44.5" r="1" fill="#ffffff" />
              {/* Smile / Mouth */}
              {isSpeaking ? (
                <path
                  d="M 45 56 Q 50 63 55 56 Z"
                  fill="#be123c"
                  className="animate-pulse"
                />
              ) : (
                <path
                  d="M 45 56 Q 50 60 55 56"
                  stroke="#be123c"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}

          {teacher.id === 'nova' && (
            <svg
              className={`w-full h-full transform transition-transform duration-200 ${
                isSpeaking ? 'scale-105' : ''
              }`}
              viewBox="0 0 100 100"
            >
              {/* Cyber Jacket */}
              <circle cx="50" cy="115" r="50" fill="#1e1b4b" />
              <path d="M 46 72 L 50 90 L 54 72 Z" fill="#38bdf8" />
              {/* Head */}
              <circle cx="50" cy="48" r="23" fill="#e0e7ff" />
              {/* Cyber Visor */}
              <path
                d="M 32 40 L 68 40 L 65 50 L 35 50 Z"
                fill="#0284c7"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <line
                x1="35"
                y1="45"
                x2="65"
                y2="45"
                stroke="#bae6fd"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                className="animate-pulse"
              />
              {/* Ear Antenna */}
              <circle cx="26" cy="48" r="4" fill="#38bdf8" />
              <circle cx="74" cy="48" r="4" fill="#38bdf8" />
              {/* Mouth */}
              {isSpeaking ? (
                <rect
                  x="44"
                  y="58"
                  width="12"
                  height="4"
                  rx="2"
                  fill="#38bdf8"
                  className="animate-pulse"
                />
              ) : (
                <line
                  x1="45"
                  y1="60"
                  x2="55"
                  y2="60"
                  stroke="#6366f1"
                  strokeWidth="2"
                />
              )}
            </svg>
          )}

          {teacher.id === 'valeria' && (
            <svg
              className={`w-full h-full transform transition-transform duration-200 ${
                isSpeaking ? 'translate-y-0.5' : ''
              }`}
              viewBox="0 0 100 100"
            >
              {/* Lab Coat */}
              <circle cx="50" cy="115" r="50" fill="#f8fafc" />
              <path d="M 44 68 L 50 78 L 56 68 Z" fill="#ec4899" />
              {/* Head */}
              <circle cx="50" cy="48" r="23" fill="#fed7aa" />
              {/* Hair bun */}
              <circle cx="50" cy="22" r="10" fill="#18181b" />
              <path
                d="M 27 45 C 27 30 73 30 73 45 C 73 34 65 26 50 26 C 35 26 27 34 27 45 Z"
                fill="#18181b"
              />
              {/* Cat-eye glasses */}
              <polygon points="33,40 46,42 43,49 34,47" fill="none" stroke="#db2777" strokeWidth="2" />
              <polygon points="67,40 54,42 57,49 66,47" fill="none" stroke="#db2777" strokeWidth="2" />
              <line x1="46" y1="43" x2="54" y2="43" stroke="#db2777" strokeWidth="2" />
              {/* Eyes */}
              <circle cx="40" cy="45" r="2" fill="#0f172a" />
              <circle cx="60" cy="45" r="2" fill="#0f172a" />
              {/* Smile */}
              {isSpeaking ? (
                <path d="M 45 56 Q 50 63 55 56 Z" fill="#db2777" />
              ) : (
                <path d="M 46 57 Q 50 60 54 57" stroke="#db2777" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          )}

          {/* Speaking Audio Indicator waves */}
          {isSpeaking && (
            <div className="absolute bottom-1 right-1 flex items-end gap-0.5 bg-slate-900/80 px-1.5 py-0.5 rounded-full">
              <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Teacher Tag */}
        <div className="mt-1.5 text-center">
          <div className="text-xs font-bold text-slate-100 flex items-center justify-center gap-1">
            {teacher.name}
          </div>
          <div className="text-[10px] text-slate-400 truncate max-w-[90px]">
            {teacher.subject}
          </div>
        </div>
      </div>

      {/* Speech Balloon */}
      {currentSpeech && (
        <div className="flex-1 bg-slate-800/90 border border-slate-700/80 backdrop-blur-md rounded-2xl rounded-tl-sm p-3.5 shadow-xl relative animate-fadeIn">
          {/* Arrow pointing to avatar */}
          <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-slate-800 border-b-8 border-b-transparent" />
          <p className="text-sm md:text-base text-slate-100 leading-relaxed font-sans">
            "{currentSpeech}"
          </p>
        </div>
      )}
    </div>
  );
};
