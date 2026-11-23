import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import type { Teacher, TeacherId } from '../types';
import { TEACHERS_LIST } from '../data/teachers';

interface TeacherPickerProps {
  selectedTeacherId: TeacherId;
  onSelectTeacher: (teacher: Teacher) => void;
}

export const TeacherPicker: React.FC<TeacherPickerProps> = ({
  selectedTeacherId,
  onSelectTeacher,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Elige a tu Profesor(a)
        </h3>
        <span className="text-[11px] text-slate-400">
          Cada uno tiene su voz, método y personalidad
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {TEACHERS_LIST.map(teacher => {
          const isSelected = teacher.id === selectedTeacherId;
          return (
            <button
              key={teacher.id}
              onClick={() => onSelectTeacher(teacher)}
              className={`relative text-left p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800 border-amber-400 shadow-lg shadow-amber-400/10 scale-[1.02]'
                  : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70 hover:border-slate-600'
              }`}
            >
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}

              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-100 text-sm shadow-md"
                  style={{ backgroundColor: teacher.avatarBg, border: `2px solid ${teacher.accentColor}` }}
                >
                  {teacher.name.split(' ')[1]?.[0] || teacher.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100 leading-tight">
                    {teacher.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {teacher.subject}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 italic line-clamp-2 mt-1">
                "{teacher.tagline}"
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
