import React, { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import type { BoardCommand, BoardStyle, Teacher } from '../types';

interface WhiteboardProps {
  boardStyle: BoardStyle;
  commands: BoardCommand[];
  activeTeacher: Teacher;
  isWriting: boolean;
  focusCoord?: [number, number];
  onDownloadReady?: (canvas: HTMLCanvasElement) => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  boardStyle,
  commands,
  activeTeacher,
  isWriting,
  focusCoord,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderedMath, setRenderedMath] = useState<{ id: string; html: string; x: number; y: number; color?: string; scale?: number }[]>([]);

  // Whiteboard internal coordinate space (1000 x 600)
  const V_WIDTH = 1000;
  const V_HEIGHT = 580;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;

    // Draw background
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    if (boardStyle === 'chalkboard') {
      // Classic slate chalkboard
      const grad = ctx.createLinearGradient(0, 0, V_WIDTH, V_HEIGHT);
      grad.addColorStop(0, '#122319');
      grad.addColorStop(0.5, '#162b20');
      grad.addColorStop(1, '#0e1d15');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // Subtle chalk dust specks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 400; i++) {
        const x = (i * 137) % V_WIDTH;
        const y = (i * 97) % V_HEIGHT;
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      // Chalk grid lines (very subtle)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 50; x < V_WIDTH; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, V_HEIGHT);
        ctx.stroke();
      }
      for (let y = 50; y < V_HEIGHT; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(V_WIDTH, y);
        ctx.stroke();
      }
    } else {
      // Clean modern whiteboard
      const grad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
      grad.addColorStop(0, '#fbfcfe');
      grad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // Subtle marker dot grid
      ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
      for (let x = 40; x < V_WIDTH; x += 40) {
        for (let y = 40; y < V_HEIGHT; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const mathItems: typeof renderedMath = [];

    // Render commands in sequence
    commands.forEach(cmd => {
      switch (cmd.type) {
        case 'clear':
          ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
          if (boardStyle === 'chalkboard') {
            ctx.fillStyle = '#162b20';
            ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
          } else {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
          }
          break;

        case 'title': {
          ctx.save();
          const titleColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#fef08a' : '#0f172a');
          ctx.fillStyle = titleColor;
          ctx.font = '700 28px "Kalam", "Caveat", cursive, sans-serif';
          ctx.fillText(cmd.text, cmd.x, cmd.y);

          // Hand-drawn wavy underline
          const textMetrics = ctx.measureText(cmd.text);
          ctx.strokeStyle = titleColor;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const uy = cmd.y + 8;
          ctx.moveTo(cmd.x, uy);
          ctx.bezierCurveTo(
            cmd.x + textMetrics.width * 0.3,
            uy + 3,
            cmd.x + textMetrics.width * 0.7,
            uy - 2,
            cmd.x + textMetrics.width,
            uy + 2
          );
          ctx.stroke();

          if (cmd.subtitle) {
            ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = boardStyle === 'chalkboard' ? '#94a3b8' : '#64748b';
            ctx.fillText(cmd.subtitle, cmd.x, cmd.y + 28);
          }
          ctx.restore();
          break;
        }

        case 'text': {
          ctx.save();
          const textColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#f8fafc' : '#1e293b');
          ctx.fillStyle = textColor;
          const fontSize = cmd.size || 18;
          if (cmd.style === 'hand') {
            ctx.font = `600 ${fontSize + 4}px "Caveat", cursive, sans-serif`;
          } else if (cmd.style === 'bold') {
            ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
          } else {
            ctx.font = `500 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
          }
          ctx.fillText(cmd.text, cmd.x, cmd.y);
          ctx.restore();
          break;
        }

        case 'box': {
          ctx.save();
          const boxColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#cbd5e1' : '#334155');
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 2.5;

          if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
          }

          // Hand-drawn box with slight corner jitter
          ctx.beginPath();
          ctx.moveTo(cmd.x, cmd.y);
          ctx.lineTo(cmd.x + cmd.width, cmd.y + 1);
          ctx.lineTo(cmd.x + cmd.width - 1, cmd.y + cmd.height);
          ctx.lineTo(cmd.x + 1, cmd.y + cmd.height - 1);
          ctx.closePath();
          ctx.stroke();

          if (cmd.label) {
            ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = boxColor;
            ctx.fillText(cmd.label.toUpperCase(), cmd.x + 10, cmd.y - 7);
          }
          ctx.restore();
          break;
        }

        case 'circle': {
          ctx.save();
          const circleColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#facc15' : '#ea580c');
          ctx.strokeStyle = circleColor;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(
            cmd.x,
            cmd.y,
            cmd.radiusX,
            cmd.radiusY || cmd.radiusX,
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'arrow': {
          ctx.save();
          const arrowColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#f87171' : '#dc2626');
          ctx.strokeStyle = arrowColor;
          ctx.fillStyle = arrowColor;
          ctx.lineWidth = 2.5;

          const [x1, y1] = cmd.from;
          const [x2, y2] = cmd.to;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = 12;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLen * Math.cos(angle - Math.PI / 6),
            y2 - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - headLen * Math.cos(angle + Math.PI / 6),
            y2 - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          if (cmd.label) {
            ctx.font = '600 14px "Caveat", cursive, sans-serif';
            ctx.fillStyle = arrowColor;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2 - 8;
            ctx.fillText(cmd.label, midX, midY);
          }
          ctx.restore();
          break;
        }

        case 'highlight': {
          ctx.save();
          ctx.fillStyle =
            cmd.color ||
            (boardStyle === 'chalkboard'
              ? 'rgba(250, 204, 21, 0.2)'
              : 'rgba(254, 240, 138, 0.5)');
          ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
          ctx.restore();
          break;
        }

        case 'graph': {
          drawCartesianGraph(ctx, cmd, boardStyle);
          break;
        }

        case 'diagram': {
          drawPredefinedDiagram(ctx, cmd, boardStyle);
          break;
        }

        case 'math': {
          // Render KaTeX HTML
          try {
            const html = katex.renderToString(cmd.latex, {
              displayMode: true,
              throwOnError: false,
            });
            mathItems.push({
              id: cmd.id,
              html,
              x: cmd.x,
              y: cmd.y,
              color: cmd.color,
              scale: cmd.scale,
            });
          } catch (e) {
            console.warn('Katex render error:', e);
          }
          break;
        }
      }
    });

    setRenderedMath(mathItems);
  }, [commands, boardStyle]);

  // Diagram Renderers
  function drawCartesianGraph(
    ctx: CanvasRenderingContext2D,
    cmd: Extract<BoardCommand, { type: 'graph' }>,
    style: BoardStyle
  ) {
    ctx.save();
    const { x, y, width, height, equations, xRange, yRange, title, highlightPoints } = cmd;

    // Background box
    ctx.fillStyle = style === 'chalkboard' ? 'rgba(0,0,0,0.3)' : '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = style === 'chalkboard' ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, width, height);

    const [xMin, xMax] = xRange;
    const [yMin, yMax] = yRange;

    const mapX = (val: number) => x + ((val - xMin) / (xMax - xMin)) * width;
    const mapY = (val: number) => y + height - ((val - yMin) / (yMax - yMin)) * height;

    // Axes
    const zeroX = mapX(0);
    const zeroY = mapY(0);

    ctx.strokeStyle = style === 'chalkboard' ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 2;
    // X Axis
    if (zeroY >= y && zeroY <= y + height) {
      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x + width, zeroY);
      ctx.stroke();
    }
    // Y Axis
    if (zeroX >= x && zeroX <= x + width) {
      ctx.beginPath();
      ctx.moveTo(zeroX, y);
      ctx.lineTo(zeroX, y + height);
      ctx.stroke();
    }

    // Grid ticks
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = style === 'chalkboard' ? '#94a3b8' : '#64748b';
    for (let xi = Math.ceil(xMin); xi <= Math.floor(xMax); xi++) {
      if (xi === 0) continue;
      const px = mapX(xi);
      if (px > x + 10 && px < x + width - 10) {
        ctx.beginPath();
        ctx.moveTo(px, zeroY - 3);
        ctx.lineTo(px, zeroY + 3);
        ctx.stroke();
        ctx.fillText(xi.toString(), px - 4, zeroY + 14);
      }
    }

    // Plot equations
    equations.forEach(eq => {
      ctx.strokeStyle = eq.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;

      for (let px = 0; px <= width; px += 2) {
        const valX = xMin + (px / width) * (xMax - xMin);
        let valY = 0;
        try {
          if (eq.expression === 'x^2') valY = valX * valX;
          else if (eq.expression === '4*x - 3') valY = 4 * valX - 3;
          else if (eq.expression === '4*x - 4') valY = 4 * valX - 4;
          else valY = valX;
        } catch {
          continue;
        }

        const py = mapY(valY);
        if (py >= y && py <= y + height) {
          if (!started) {
            ctx.moveTo(x + px, py);
            started = true;
          } else {
            ctx.lineTo(x + px, py);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();

      if (eq.label) {
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = eq.color;
        ctx.fillText(eq.label, x + width - 75, y + 25 + equations.indexOf(eq) * 18);
      }
    });

    // Highlight points
    highlightPoints?.forEach(pt => {
      const px = mapX(pt.x);
      const py = mapY(pt.y);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = style === 'chalkboard' ? '#f8fafc' : '#0f172a';
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(pt.label, px + 8, py - 4);
    });

    if (title) {
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = style === 'chalkboard' ? '#e2e8f0' : '#1e293b';
      ctx.fillText(title, x + 12, y + 20);
    }
    ctx.restore();
  }

  function drawPredefinedDiagram(
    ctx: CanvasRenderingContext2D,
    cmd: Extract<BoardCommand, { type: 'diagram' }>,
    style: BoardStyle
  ) {
    ctx.save();
    const { x, y, width, height, kind } = cmd;

    if (kind === 'projectile') {
      // Table / cliff edge
      ctx.fillStyle = style === 'chalkboard' ? '#334155' : '#e2e8f0';
      ctx.fillRect(x, y + 60, 90, height - 60);

      // Floor line
      ctx.strokeStyle = style === 'chalkboard' ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();

      // Ball A: Dropped vertically
      const ballAX = x + 30;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ballAX, y + 45, 12, 0, Math.PI * 2);
      ctx.fill();

      // Dotted straight path down
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ballAX, y + 45);
      ctx.lineTo(ballAX, y + height - 12);
      ctx.stroke();

      // Ground impact A
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ballAX, y + height - 12, 12, 0, Math.PI * 2);
      ctx.fill();

      // Ball B: Thrown sideways
      const ballBX = x + 70;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(ballBX, y + 45, 12, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal velocity arrow
      ctx.setLineDash([]);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ballBX + 14, y + 45);
      ctx.lineTo(ballBX + 60, y + 45);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(ballBX + 60, y + 45);
      ctx.lineTo(ballBX + 50, y + 40);
      ctx.lineTo(ballBX + 50, y + 50);
      ctx.fill();

      // Parabolic arc for B
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ballBX, y + 45);
      const impactBX = x + width - 50;
      ctx.quadraticCurveTo(ballBX + 180, y + 50, impactBX, y + height - 12);
      ctx.stroke();

      // Ground impact B
      ctx.setLineDash([]);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(impactBX, y + height - 12, 12, 0, Math.PI * 2);
      ctx.fill();

      // Labels
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('A (Soltada)', ballAX - 25, y + 25);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('B (Lanzada v_x)', ballBX - 10, y + 25);

      // Same time marker
      ctx.fillStyle = '#fef08a';
      ctx.font = '700 14px "Caveat", cursive, sans-serif';
      ctx.fillText('✓ ¡Mismo tiempo t = √(2h/g)!', x + width / 2 - 80, y + height - 25);
    } else if (kind === 'photosynthesis') {
      // Chloroplast container
      ctx.fillStyle = style === 'chalkboard' ? 'rgba(6, 78, 59, 0.4)' : '#ecfdf5';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 16);
      ctx.fill();
      ctx.stroke();

      // Title tag
      ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#10b981';
      ctx.fillText('CLOROPLASTO', x + 20, y + 28);

      // Stage 1: Thylakoid membrane
      ctx.fillStyle = style === 'chalkboard' ? 'rgba(5, 150, 105, 0.5)' : '#a7f3d0';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 40, y + 50, 320, 200, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = style === 'chalkboard' ? '#ecfdf5' : '#065f46';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Fase Lumínica (Tilacoides)', x + 60, y + 80);

      // Light + H2O in, O2 out
      ctx.font = '600 14px "Caveat", cursive, sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText('☀️ Luz solar', x + 60, y + 115);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('💧 H₂O (Agua)', x + 60, y + 145);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('🍃 Libera O₂ (Oxígeno)', x + 60, y + 225);

      // Stage 2: Stroma (Calvin Cycle)
      ctx.fillStyle = style === 'chalkboard' ? 'rgba(217, 119, 6, 0.3)' : '#fef3c7';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 500, y + 50, 320, 200, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = style === 'chalkboard' ? '#fef3c7' : '#92400e';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Ciclo de Calvin (Estroma)', x + 530, y + 80);

      ctx.font = '600 14px "Caveat", cursive, sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.fillText('💨 Entrada: CO₂', x + 540, y + 120);
      ctx.fillStyle = '#facc15';
      ctx.fillText('🍬 Salida: Glucosa (C₆H₁₂O₆)', x + 540, y + 225);

      // Bridge arrows: ATP & NADPH -> and ADP + NADP+ <-
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 365, y + 110);
      ctx.lineTo(x + 495, y + 110);
      ctx.stroke();
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText('ATP + NADPH ➔', x + 380, y + 102);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 495, y + 170);
      ctx.lineTo(x + 365, y + 170);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('⬅ ADP + NADP+', x + 380, y + 190);
    }
    ctx.restore();
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-[1000/580] rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border-4 ${
        boardStyle === 'chalkboard'
          ? 'border-amber-950/80 bg-[#122319]'
          : 'border-slate-300 bg-white'
      }`}
    >
      {/* Chalk / Whiteboard Tray Simulation at bottom */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-4 z-10 flex items-center justify-end px-6 gap-2 border-t ${
          boardStyle === 'chalkboard'
            ? 'bg-amber-950/90 border-amber-900'
            : 'bg-slate-200 border-slate-300'
        }`}
      >
        {/* Decorative Chalk pieces / markers */}
        {boardStyle === 'chalkboard' ? (
          <>
            <div className="w-8 h-2 rounded-sm bg-white/90 shadow-sm transform -rotate-2" />
            <div className="w-7 h-2 rounded-sm bg-yellow-200/90 shadow-sm transform rotate-1" />
            <div className="w-6 h-2 rounded-sm bg-cyan-200/90 shadow-sm" />
            <div className="w-12 h-3 rounded bg-amber-900 border border-amber-800 text-[8px] text-amber-200 flex items-center justify-center font-bold">
              BORRADOR
            </div>
          </>
        ) : (
          <>
            <div className="w-9 h-2.5 rounded-full bg-slate-900 shadow-sm" />
            <div className="w-9 h-2.5 rounded-full bg-blue-600 shadow-sm" />
            <div className="w-9 h-2.5 rounded-full bg-red-600 shadow-sm" />
          </>
        )}
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ imageRendering: 'auto' }}
      />

      {/* KaTeX Math Overlay Elements */}
      {renderedMath.map(item => (
        <div
          key={item.id}
          className="absolute transform -translate-y-1/2 pointer-events-none select-none transition-opacity duration-300"
          style={{
            left: `${(item.x / V_WIDTH) * 100}%`,
            top: `${(item.y / V_HEIGHT) * 100}%`,
            color:
              item.color || (boardStyle === 'chalkboard' ? '#f8fafc' : '#0f172a'),
            transform: `scale(${item.scale || 1.1})`,
            transformOrigin: 'left center',
          }}
          dangerouslySetInnerHTML={{ __html: item.html }}
        />
      ))}

      {/* Live Writing Marker / Pointer (Travels to focus coordinate) */}
      {isWriting && focusCoord && (
        <div
          className="absolute pointer-events-none transition-all duration-300 ease-out z-20"
          style={{
            left: `${(focusCoord[0] / V_WIDTH) * 100}%`,
            top: `${(focusCoord[1] / V_HEIGHT) * 100}%`,
          }}
        >
          {/* Animated Hand / Stylus indicator */}
          <div className="relative -top-2 -left-2 flex items-center gap-1.5 animate-bounce">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg animate-ping absolute"
              style={{ backgroundColor: activeTeacher.accentColor }}
            />
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-md relative z-10"
              style={{ backgroundColor: activeTeacher.accentColor }}
            />
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded shadow-md backdrop-blur-md whitespace-nowrap"
              style={{
                backgroundColor:
                  boardStyle === 'chalkboard'
                    ? 'rgba(15, 23, 42, 0.85)'
                    : 'rgba(255, 255, 255, 0.9)',
                color:
                  boardStyle === 'chalkboard'
                    ? '#f8fafc'
                    : '#0f172a',
              }}
            >
              ✍️ {activeTeacher.name} escribe...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
