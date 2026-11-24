import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import type { ChatMessage, SocraticCheck, Teacher } from '../types';

interface LiveTutorChatProps {
  teacher: Teacher;
  isSpeaking: boolean;
  isWriting: boolean;
  messages: ChatMessage[];
  activeSocratic?: SocraticCheck;
  isWaitingForSocratic: boolean;
  onSendMessage: (text: string) => void;
  onAnswerSocraticOption: (index: number, optionText: string) => void;
  onReplayAudio: () => void;
  isGeneratingReply: boolean;
}

export const LiveTutorChat: React.FC<LiveTutorChatProps> = ({
  teacher,
  isSpeaking,
  isWriting,
  messages,
  activeSocratic,
  isWaitingForSocratic,
  onSendMessage,
  onAnswerSocraticOption,
  onReplayAudio,
  isGeneratingReply,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaitingForSocratic, isGeneratingReply]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGeneratingReply) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const toggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz. Escribe tu pregunta en el cuadro de texto.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        onSendMessage(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Teacher Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform ${
                isSpeaking ? 'scale-105 ring-2 ring-indigo-500 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: teacher.accentColor }}
            >
              {teacher.name.split(' ')[1]?.[0] || teacher.name[0]}
            </div>
            {isSpeaking && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 leading-tight">{teacher.name}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              {isSpeaking ? (
                <span className="text-indigo-600 font-semibold">Hablando en directo...</span>
              ) : isWriting ? (
                <span className="text-amber-600 font-semibold">Dibujando en pizarra...</span>
              ) : isWaitingForSocratic ? (
                <span className="text-emerald-600 font-semibold">Esperando tu respuesta...</span>
              ) : (
                <span>{teacher.subject}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onReplayAudio}
          className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          title="Volver a escuchar este paso"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[280px] max-h-[460px] bg-slate-50/30">
        {messages.map(msg => {
          if (msg.sender === 'student') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs md:text-sm shadow-sm">
                  <span className="block text-[10px] font-bold text-indigo-200 mb-0.5">Tú</span>
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%] bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs md:text-sm shadow-sm leading-relaxed">
                {msg.isQuestion && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                    <Sparkles className="w-3 h-3" /> Pregunta del tutor
                  </span>
                )}
                <p className="m-0">{msg.text}</p>
              </div>
            </div>
          );
        })}

        {/* Inline Interactive Quick-Reply Options when Tutor asks a question */}
        {isWaitingForSocratic && activeSocratic?.options && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 space-y-2">
            <div className="text-[11px] font-bold text-indigo-800">
              Responde para continuar la clase:
            </div>
            <div className="flex flex-col gap-1.5">
              {activeSocratic.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => onAnswerSocraticOption(idx, opt)}
                  className="text-left px-3 py-2 rounded-xl bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-xs font-medium text-slate-800 transition-colors shadow-xs"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {isGeneratingReply && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2 text-xs text-slate-500 italic">
              {teacher.name} está pensando y preparando la pizarra...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interruption / Reply Input */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-slate-100 bg-white flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={toggleMicrophone}
          className={`p-2 rounded-xl border transition-colors ${
            isListening
              ? 'bg-rose-500 border-rose-500 text-white animate-pulse'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          title="Hablar por micrófono"
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Interrumpe o responde aquí..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={!input.trim() || isGeneratingReply}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
          title="Enviar al tutor"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
