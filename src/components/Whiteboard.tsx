import React, { useEffect, useRef, useState, useCallback } from 'react';
import katex from 'katex';
import {
  PenTool,
  Eraser,
  RotateCcw,
  FastForward,
  Download,
} from 'lucide-react';
import type { BoardCommand, BoardStyle, Teacher } from '../types';

interface WhiteboardProps {
  boardStyle: BoardStyle;
  commands: BoardCommand[];
  activeTeacher: Teacher;
  isWriting: boolean;
  focusCoord?: [number, number];
  onDownloadReady?: (canvas: HTMLCanvasElement) => void;
}

interface StylusState {
  x: number;
  y: number;
  color: string;
  visible: boolean;
}

interface UserStroke {
  color: string;
  width: number;
  points: [number, number][];
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  boardStyle,
  commands,
  activeTeacher,
  isWriting,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const userCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [renderedMath, setRenderedMath] = useState<{
    id: string;
    html: string;
    x: number;
    y: number;
    color?: string;
    scale?: number;
  }[]>([]);

  // Stylus state for real-time animated marker
  const [stylus, setStylus] = useState<StylusState>({
    x: 0,
    y: 0,
    color: activeTeacher.accentColor || '#2563eb',
    visible: false,
  });

  // Student drawing layer states
  const [isDrawModeActive, setIsDrawModeActive] = useState<boolean>(false);
  const [userColor, setUserColor] = useState<string>('#2563eb');
  const [userStrokeWidth, setUserStrokeWidth] = useState<number>(3);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [userStrokes, setUserStrokes] = useState<UserStroke[]>([]);
  const isDrawingUser = useRef<boolean>(false);
  const currentStrokePoints = useRef<[number, number][]>([]);

  // Animation cancel ref to allow skipping or interrupting
  const cancelAnimRef = useRef<boolean>(false);
  const [isAnimatingStroke, setIsAnimatingStroke] = useState<boolean>(false);

  // Whiteboard internal coordinate space (1000 x 580)
  const V_WIDTH = 1000;
  const V_HEIGHT = 580;

  // Render static background
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
    if (boardStyle === 'chalkboard') {
      const grad = ctx.createLinearGradient(0, 0, V_WIDTH, V_HEIGHT);
      grad.addColorStop(0, '#122319');
      grad.addColorStop(0.5, '#162b20');
      grad.addColorStop(1, '#0e1d15');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 400; i++) {
        const x = (i * 137) % V_WIDTH;
        const y = (i * 97) % V_HEIGHT;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    } else {
      // Clean modern whiteboard with subtle dot grid
      const grad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
      grad.addColorStop(0, '#fdfdfe');
      grad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
      for (let x = 40; x < V_WIDTH; x += 40) {
        for (let y = 40; y < V_HEIGHT; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [boardStyle]);

  // Full instant command renderer (static or when skipped)
  const renderAllCommandsInstant = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    cancelAnimRef.current = true;
    setIsAnimatingStroke(false);
    setStylus(prev => ({ ...prev, visible: false }));

    drawBackground(ctx);
    const mathItems: typeof renderedMath = [];

    commands.forEach(cmd => {
      switch (cmd.type) {
        case 'clear':
          drawBackground(ctx);
          break;

        case 'title': {
          ctx.save();
          const titleColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#fef08a' : '#1e3a8a');
          ctx.fillStyle = titleColor;
          ctx.font = '700 26px "Kalam", "Patrick Hand", cursive, sans-serif';
          ctx.fillText(cmd.text, cmd.x, cmd.y);

          // Wavy underline
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
            ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = boardStyle === 'chalkboard' ? '#94a3b8' : '#475569';
            ctx.fillText(cmd.subtitle, cmd.x, cmd.y + 26);
          }
          ctx.restore();
          break;
        }

        case 'text': {
          ctx.save();
          const textColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#f8fafc' : '#0f172a');
          ctx.fillStyle = textColor;
          const fontSize = cmd.size || 17;
          ctx.font = `${cmd.style === 'bold' ? '700' : '600'} ${fontSize}px "Patrick Hand", "Caveat", cursive, sans-serif`;
          ctx.fillText(cmd.text, cmd.x, cmd.y);
          ctx.restore();
          break;
        }

        case 'box': {
          ctx.save();
          const boxColor =
            cmd.color || (boardStyle === 'chalkboard' ? '#cbd5e1' : '#2563eb');
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 2.5;

          if (cmd.fill) {
            ctx.fillStyle = cmd.fill;
            ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
          }

          ctx.strokeRect(cmd.x, cmd.y, cmd.width, cmd.height);

          if (cmd.label) {
            ctx.font = '700 13px "Patrick Hand", "Plus Jakarta Sans", sans-serif';
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

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = 14;
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
            ctx.font = '600 14px "Patrick Hand", cursive';
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
              : 'rgba(254, 240, 138, 0.55)');
          ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
          ctx.restore();
          break;
        }

        case 'curve': {
          drawCurveInstant(ctx, cmd);
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
          } catch {}
          break;
        }
      }
    });

    setRenderedMath(mathItems);
  }, [commands, boardStyle, drawBackground]);

  // LIVE STROKE ANIMATION ENGINE (Khan Academy / Ahaboard Real-Time Writing)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;

    // If there are no commands or writing is false, render instantly
    if (commands.length === 0 || !isWriting) {
      renderAllCommandsInstant();
      return;
    }

    // Cancel any ongoing animation
    cancelAnimRef.current = false;
    setIsAnimatingStroke(true);
    drawBackground(ctx);

    let cmdIdx = 0;

    const runNextCommand = () => {
      if (cancelAnimRef.current || cmdIdx >= commands.length) {
        setIsAnimatingStroke(false);
        setStylus(prev => ({ ...prev, visible: false }));
        return;
      }

      const cmd = commands[cmdIdx];
      cmdIdx++;

      switch (cmd.type) {
        case 'clear':
          drawBackground(ctx);
          runNextCommand();
          break;

        case 'title': {
          const color = cmd.color || '#1e3a8a';
          animateTextHandwriting(
            ctx,
            cmd.text,
            cmd.x,
            cmd.y,
            26,
            color,
            'Kalam',
            () => {
              if (cmd.subtitle) {
                animateTextHandwriting(
                  ctx,
                  cmd.subtitle,
                  cmd.x,
                  cmd.y + 26,
                  14,
                  '#475569',
                  'Plus Jakarta Sans',
                  runNextCommand
                );
              } else {
                runNextCommand();
              }
            }
          );
          break;
        }

        case 'text': {
          const color = cmd.color || (boardStyle === 'chalkboard' ? '#f8fafc' : '#0f172a');
          const fontSize = cmd.size || 17;
          animateTextHandwriting(
            ctx,
            cmd.text,
            cmd.x,
            cmd.y,
            fontSize,
            color,
            'Patrick Hand',
            runNextCommand
          );
          break;
        }

        case 'box': {
          const boxColor = cmd.color || '#2563eb';
          animateBoxStroke(
            ctx,
            cmd.x,
            cmd.y,
            cmd.width,
            cmd.height,
            boxColor,
            cmd.label,
            runNextCommand
          );
          break;
        }

        case 'circle': {
          const circleColor = cmd.color || (boardStyle === 'chalkboard' ? '#facc15' : '#ea580c');
          animateCircleStroke(
            ctx,
            cmd.x,
            cmd.y,
            cmd.radiusX,
            cmd.radiusY || cmd.radiusX,
            circleColor,
            cmd.label,
            runNextCommand
          );
          break;
        }

        case 'curve': {
          const curveColor = cmd.color || '#2563eb';
          animateCurveStroke(
            ctx,
            cmd.points,
            curveColor,
            cmd.lineWidth || 3,
            cmd.dashed,
            cmd.closed,
            cmd.fill,
            cmd.label,
            runNextCommand
          );
          break;
        }

        case 'arrow': {
          const arrowColor = cmd.color || '#dc2626';
          animateArrowStroke(
            ctx,
            cmd.from[0],
            cmd.from[1],
            cmd.to[0],
            cmd.to[1],
            arrowColor,
            () => {
              if (cmd.label) {
                const midX = (cmd.from[0] + cmd.to[0]) / 2;
                const midY = (cmd.from[1] + cmd.to[1]) / 2 - 8;
                animateTextHandwriting(
                  ctx,
                  cmd.label,
                  midX,
                  midY,
                  14,
                  arrowColor,
                  'Patrick Hand',
                  runNextCommand
                );
              } else {
                runNextCommand();
              }
            }
          );
          break;
        }

        case 'highlight': {
          ctx.save();
          ctx.fillStyle = cmd.color || 'rgba(254, 240, 138, 0.55)';
          ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
          ctx.restore();
          setStylus({
            x: cmd.x + cmd.width,
            y: cmd.y + cmd.height / 2,
            color: '#eab308',
            visible: true,
          });
          setTimeout(runNextCommand, 150);
          break;
        }

        case 'math': {
          try {
            const html = katex.renderToString(cmd.latex, {
              displayMode: true,
              throwOnError: false,
            });
            setRenderedMath(prev => [
              ...prev,
              { id: cmd.id, html, x: cmd.x, y: cmd.y, color: cmd.color, scale: cmd.scale },
            ]);
          } catch {}
          runNextCommand();
          break;
        }

        case 'graph': {
          drawCartesianGraph(ctx, cmd, boardStyle);
          setStylus({ x: cmd.x + cmd.width, y: cmd.y + cmd.height / 2, color: '#2563eb', visible: true });
          setTimeout(runNextCommand, 220);
          break;
        }

        case 'diagram': {
          drawPredefinedDiagram(ctx, cmd, boardStyle);
          setStylus({ x: cmd.x + cmd.width / 2, y: cmd.y + cmd.height / 2, color: '#2563eb', visible: true });
          setTimeout(runNextCommand, 260);
          break;
        }

        default:
          runNextCommand();
          break;
      }
    };

    runNextCommand();

    return () => {
      cancelAnimRef.current = true;
    };
  }, [commands, isWriting, boardStyle, drawBackground, renderAllCommandsInstant]);

  // ANIMATION PRIMITIVES
  const animateTextHandwriting = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    fontFamily: string,
    onDone: () => void
  ) => {
    ctx.save();
    ctx.font = `700 ${size}px "${fontFamily}", "Patrick Hand", cursive, sans-serif`;
    ctx.fillStyle = color;

    let charIdx = 0;
    let curX = x;

    const step = () => {
      if (cancelAnimRef.current) {
        ctx.restore();
        return;
      }
      if (charIdx < text.length) {
        const char = text[charIdx];
        ctx.fillText(char, curX, y);
        const charWidth = ctx.measureText(char).width;
        curX += charWidth;
        setStylus({ x: curX, y, color, visible: true });
        charIdx++;
        setTimeout(step, 14);
      } else {
        ctx.restore();
        onDone();
      }
    };

    step();
  };

  const animateLineStroke = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number,
    onDone: () => void
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    let progress = 0;
    const steps = 15;

    const step = () => {
      if (cancelAnimRef.current) {
        ctx.restore();
        return;
      }
      progress++;
      const t = Math.min(1, progress / steps);
      const curX = x1 + (x2 - x1) * t;
      const curY = y1 + (y2 - y1) * t;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(curX, curY);
      ctx.stroke();

      setStylus({ x: curX, y: curY, color, visible: true });

      if (t < 1) {
        setTimeout(step, 12);
      } else {
        ctx.restore();
        onDone();
      }
    };

    step();
  };

  const animateBoxStroke = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    label?: string,
    onDone?: () => void
  ) => {
    animateLineStroke(ctx, x, y, x + w, y, color, 2.5, () => {
      animateLineStroke(ctx, x + w, y, x + w, y + h, color, 2.5, () => {
        animateLineStroke(ctx, x + w, y + h, x, y + h, color, 2.5, () => {
          animateLineStroke(ctx, x, y + h, x, y, color, 2.5, () => {
            if (label) {
              animateTextHandwriting(
                ctx,
                label.toUpperCase(),
                x + 10,
                y - 7,
                13,
                color,
                'Patrick Hand',
                () => onDone?.()
              );
            } else {
              onDone?.();
            }
          });
        });
      });
    });
  };

  const animateArrowStroke = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    onDone: () => void
  ) => {
    animateLineStroke(ctx, x1, y1, x2, y2, color, 2.5, () => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 14;
      const h1X = x2 - headLen * Math.cos(angle - Math.PI / 6);
      const h1Y = y2 - headLen * Math.sin(angle - Math.PI / 6);
      const h2X = x2 - headLen * Math.cos(angle + Math.PI / 6);
      const h2Y = y2 - headLen * Math.sin(angle + Math.PI / 6);

      animateLineStroke(ctx, x2, y2, h1X, h1Y, color, 2.5, () => {
        animateLineStroke(ctx, x2, y2, h2X, h2Y, color, 2.5, onDone);
      });
    });
  };

  const animateCircleStroke = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
    label?: string,
    onDone?: () => void
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';

    let progress = 0;
    const steps = 28;
    let prevX = cx + rx;
    let prevY = cy;

    const step = () => {
      if (cancelAnimRef.current) {
        ctx.restore();
        return;
      }
      progress++;
      const angle = (progress / steps) * Math.PI * 2;
      const curX = cx + rx * Math.cos(angle);
      const curY = cy + ry * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(curX, curY);
      ctx.stroke();

      prevX = curX;
      prevY = curY;
      setStylus({ x: curX, y: curY, color, visible: true });

      if (progress < steps) {
        setTimeout(step, 14);
      } else {
        ctx.restore();
        if (label) {
          animateTextHandwriting(
            ctx,
            label,
            cx - rx + 12,
            cy + 5,
            15,
            color,
            'Patrick Hand',
            () => onDone?.()
          );
        } else {
          onDone?.();
        }
      }
    };

    step();
  };

  function drawCurveInstant(
    ctx: CanvasRenderingContext2D,
    cmd: Extract<BoardCommand, { type: 'curve' }>
  ) {
    if (!cmd.points || cmd.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = cmd.color || '#2563eb';
    ctx.lineWidth = cmd.lineWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (cmd.dashed) ctx.setLineDash([8, 6]);

    ctx.beginPath();
    ctx.moveTo(cmd.points[0][0], cmd.points[0][1]);
    for (let i = 1; i < cmd.points.length; i++) {
      ctx.lineTo(cmd.points[i][0], cmd.points[i][1]);
    }
    if (cmd.closed) ctx.closePath();
    if (cmd.fill) {
      ctx.fillStyle = cmd.fill;
      ctx.fill();
    }
    ctx.stroke();

    if (cmd.label) {
      const mid = cmd.points[Math.floor(cmd.points.length / 2)];
      ctx.setLineDash([]);
      ctx.font = '700 14px "Patrick Hand", cursive';
      ctx.fillStyle = cmd.color || '#2563eb';
      ctx.fillText(cmd.label, mid[0] + 8, mid[1] - 8);
    }
    ctx.restore();
  }

  const animateCurveStroke = (
    ctx: CanvasRenderingContext2D,
    points: [number, number][],
    color: string,
    lineWidth: number,
    dashed?: boolean,
    closed?: boolean,
    fill?: string,
    label?: string,
    onDone?: () => void
  ) => {
    if (!points || points.length < 2) {
      onDone?.();
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dashed) ctx.setLineDash([8, 6]);

    let idx = 1;
    const step = () => {
      if (cancelAnimRef.current) {
        ctx.restore();
        return;
      }
      if (idx < points.length) {
        const [x1, y1] = points[idx - 1];
        const [x2, y2] = points[idx];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        setStylus({ x: x2, y: y2, color, visible: true });
        idx++;
        setTimeout(step, 24);
      } else {
        if (closed && points.length > 2) {
          ctx.beginPath();
          ctx.moveTo(points[points.length - 1][0], points[points.length - 1][1]);
          ctx.lineTo(points[0][0], points[0][1]);
          ctx.stroke();
        }
        if (fill) {
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
        }
        ctx.restore();
        if (label) {
          const mid = points[Math.floor(points.length / 2)];
          animateTextHandwriting(
            ctx,
            label,
            mid[0] + 8,
            mid[1] - 8,
            14,
            color,
            'Patrick Hand',
            () => onDone?.()
          );
        } else {
          onDone?.();
        }
      }
    };

    step();
  };

  // STUDENT DRAWING HANDLERS
  const startUserDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawModeActive) return;
    const canvas = userCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    isDrawingUser.current = true;
    currentStrokePoints.current = [[x, y]];

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 24;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = userColor;
      ctx.lineWidth = userStrokeWidth;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawUserMovement = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawModeActive || !isDrawingUser.current) return;
    const canvas = userCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    currentStrokePoints.current.push([x, y]);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopUserDrawing = () => {
    if (!isDrawModeActive || !isDrawingUser.current) return;
    isDrawingUser.current = false;
    const canvas = userCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.restore();

    if (currentStrokePoints.current.length > 1) {
      setUserStrokes(prev => [
        ...prev,
        {
          color: isEraser ? 'erase' : userColor,
          width: isEraser ? 24 : userStrokeWidth,
          points: currentStrokePoints.current,
        },
      ]);
    }
    currentStrokePoints.current = [];
  };

  const clearStudentNotes = () => {
    const canvas = userCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
    setUserStrokes([]);
  };

  const handleDownloadBoard = () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    // Create export canvas merging teacher board + student annotations
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = V_WIDTH;
    exportCanvas.height = V_HEIGHT;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return;

    expCtx.drawImage(mainCanvas, 0, 0);
    if (userCanvasRef.current) {
      expCtx.drawImage(userCanvasRef.current, 0, 0);
    }

    const link = document.createElement('a');
    link.download = `pizarra_clase_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Diagram Renderers
  function drawCartesianGraph(
    ctx: CanvasRenderingContext2D,
    cmd: Extract<BoardCommand, { type: 'graph' }>,
    style: BoardStyle
  ) {
    ctx.save();
    const { x, y, width, height, equations, xRange, yRange, title } = cmd;

    ctx.fillStyle = style === 'chalkboard' ? 'rgba(0,0,0,0.3)' : '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = style === 'chalkboard' ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, width, height);

    const [xMin, xMax] = xRange;
    const [yMin, yMax] = yRange;

    const mapX = (val: number) => x + ((val - xMin) / (xMax - xMin)) * width;
    const mapY = (val: number) => y + height - ((val - yMin) / (yMax - yMin)) * height;

    const zeroX = mapX(0);
    const zeroY = mapY(0);

    ctx.strokeStyle = style === 'chalkboard' ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 2;
    if (zeroY >= y && zeroY <= y + height) {
      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x + width, zeroY);
      ctx.stroke();
    }
    if (zeroX >= x && zeroX <= x + width) {
      ctx.beginPath();
      ctx.moveTo(zeroX, y);
      ctx.lineTo(zeroX, y + height);
      ctx.stroke();
    }

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
      ctx.fillStyle = style === 'chalkboard' ? '#334155' : '#e2e8f0';
      ctx.fillRect(x, y + 60, 90, height - 60);

      ctx.strokeStyle = style === 'chalkboard' ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();

      const ballAX = x + 30;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ballAX, y + 45, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ballAX, y + 45);
      ctx.lineTo(ballAX, y + height - 12);
      ctx.stroke();

      const ballBX = x + 70;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(ballBX, y + 45, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ballBX, y + 45);
      const impactBX = x + width - 50;
      ctx.quadraticCurveTo(ballBX + 180, y + 50, impactBX, y + height - 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  return (
    <div className="space-y-2">
      {/* Whiteboard Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Student Drawing Controls */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setIsDrawModeActive(!isDrawModeActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isDrawModeActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Activar o desactivar tu propio rotulador para escribir o hacer anotaciones en la pizarra"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{isDrawModeActive ? 'Modo Dibujo: ACTIVO' : '✏️ Dibujar tú'}</span>
          </button>

          {isDrawModeActive && (
            <>
              <div className="flex items-center gap-1.5 px-2 border-l border-slate-200">
                <button
                  onClick={() => {
                    setUserColor('#2563eb');
                    setIsEraser(false);
                    setUserStrokeWidth(3);
                  }}
                  className={`w-5 h-5 rounded-full bg-blue-600 transition-transform ${
                    userColor === '#2563eb' && !isEraser ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'opacity-80'
                  }`}
                  title="Rotulador Azul"
                />
                <button
                  onClick={() => {
                    setUserColor('#dc2626');
                    setIsEraser(false);
                    setUserStrokeWidth(3);
                  }}
                  className={`w-5 h-5 rounded-full bg-red-600 transition-transform ${
                    userColor === '#dc2626' && !isEraser ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'opacity-80'
                  }`}
                  title="Rotulador Rojo"
                />
                <button
                  onClick={() => {
                    setUserColor('#0f172a');
                    setIsEraser(false);
                    setUserStrokeWidth(3);
                  }}
                  className={`w-5 h-5 rounded-full bg-slate-900 transition-transform ${
                    userColor === '#0f172a' && !isEraser ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'opacity-80'
                  }`}
                  title="Rotulador Negro"
                />
                <button
                  onClick={() => {
                    setUserColor('#059669');
                    setIsEraser(false);
                    setUserStrokeWidth(3);
                  }}
                  className={`w-5 h-5 rounded-full bg-emerald-600 transition-transform ${
                    userColor === '#059669' && !isEraser ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'opacity-80'
                  }`}
                  title="Rotulador Verde"
                />
                <button
                  onClick={() => {
                    setUserColor('rgba(250, 204, 21, 0.45)');
                    setIsEraser(false);
                    setUserStrokeWidth(16);
                  }}
                  className={`w-5 h-5 rounded-full bg-yellow-400 transition-transform ${
                    userColor.includes('250, 204, 21') && !isEraser ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110' : 'opacity-80'
                  }`}
                  title="Subrayador"
                />
                <button
                  onClick={() => setIsEraser(true)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                    isEraser ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Goma de borrar"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Goma</span>
                </button>
              </div>

              {userStrokes.length > 0 && (
                <button
                  onClick={clearStudentNotes}
                  className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  Limpiar
                </button>
              )}
            </>
          )}
        </div>

        {/* Board Fast-Forward & Download Controls */}
        <div className="flex items-center gap-2">
          {isAnimatingStroke && (
            <button
              onClick={renderAllCommandsInstant}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1 transition-colors"
              title="Mostrar todo el contenido de la pizarra de inmediato"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Ver Todo</span>
            </button>
          )}

          <button
            onClick={handleDownloadBoard}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs transition-colors"
            title="Guardar captura de la pizarra completa en PNG"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Guardar Apuntes</span>
          </button>
        </div>
      </div>

      {/* Main Whiteboard Canvas Container */}
      <div
        ref={containerRef}
        className={`relative w-full aspect-[1000/580] rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border-4 ${
          boardStyle === 'chalkboard'
            ? 'border-amber-950/80 bg-[#122319]'
            : 'border-slate-300 bg-white'
        }`}
      >
        {/* Base Canvas (Teacher's real-time animated strokes) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          width={V_WIDTH}
          height={V_HEIGHT}
        />

        {/* Student Drawing Overlay Canvas */}
        <canvas
          ref={userCanvasRef}
          className={`absolute inset-0 w-full h-full block z-20 ${
            isDrawModeActive ? 'cursor-crosshair' : 'pointer-events-none'
          }`}
          width={V_WIDTH}
          height={V_HEIGHT}
          onPointerDown={startUserDrawing}
          onPointerMove={drawUserMovement}
          onPointerUp={stopUserDrawing}
          onPointerLeave={stopUserDrawing}
        />

        {/* REAL-TIME DRY-ERASE MARKER STYLUS (Rotulador físico que sigue el trazo) */}
        {stylus.visible && (
          <div
            className="absolute pointer-events-none z-30 transition-transform duration-75"
            style={{
              left: `${(stylus.x / V_WIDTH) * 100}%`,
              top: `${(stylus.y / V_HEIGHT) * 100}%`,
              filter: 'drop-shadow(2px 5px 4px rgba(0,0,0,0.25))',
            }}
          >
            <svg
              width="38"
              height="64"
              viewBox="0 0 42 70"
              fill="none"
              style={{ transform: 'translate(-6px, -62px)' }}
            >
              {/* Marker Body */}
              <rect x="14" y="6" width="14" height="42" rx="3" fill="#1e293b" />
              <rect x="16" y="10" width="10" height="34" rx="2" fill={stylus.color} />
              {/* Grip */}
              <rect x="14" y="44" width="14" height="10" rx="1" fill="#0f172a" />
              {/* Cone nib holder */}
              <polygon points="15,54 27,54 23,63 19,63" fill="#cbd5e1" />
              {/* Felt Tip (Point drawing the ink) */}
              <polygon points="19,63 23,63 21,69" fill={stylus.color} />
            </svg>
          </div>
        )}

        {/* KaTeX Math Overlay Elements */}
        {renderedMath.map(item => (
          <div
            key={item.id}
            className="absolute transform -translate-y-1/2 pointer-events-none select-none transition-opacity duration-300 z-10"
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

        {/* Aluminum Bottom Tray with Markers and Eraser */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-4 z-10 flex items-center justify-end px-6 gap-2 border-t ${
            boardStyle === 'chalkboard'
              ? 'bg-amber-950/90 border-amber-900'
              : 'bg-slate-200 border-slate-300'
          }`}
        >
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
              <div className="w-9 h-2.5 rounded-full bg-emerald-600 shadow-sm" />
              <div className="w-12 h-3 rounded bg-slate-700 text-[8px] text-white flex items-center justify-center font-bold shadow-sm">
                BORRADOR
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
