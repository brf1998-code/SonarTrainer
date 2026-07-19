import { useEffect, useRef } from 'react';
import { Simulation, NB_BINS } from '../sim/simulation';
import { Tracker } from '../sim/types';

const ROWS_SHOWN = 160;

function color(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v));
  if (x < 0.5) {
    const k = x / 0.5;
    return [Math.round(5 + 20 * k), Math.round(20 + 90 * k), Math.round(35 + 80 * k)];
  }
  const k = (x - 0.5) / 0.5;
  return [Math.round(25 + 220 * k), Math.round(110 + 145 * k), Math.round(115 + 120 * k)];
}

interface Props {
  sim: Simulation;
  tracker: Tracker | null;
  tick: number;
}

export default function NarrowbandDisplay({ sim, tracker, tick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#020608';
    ctx.fillRect(0, 0, NB_BINS, ROWS_SHOWN);
    if (!tracker) return;
    const rows = sim.nbRows.get(tracker.id) ?? [];
    const shown = rows.slice(-ROWS_SHOWN);
    const img = ctx.createImageData(NB_BINS, ROWS_SHOWN);
    for (let r = 0; r < ROWS_SHOWN; r++) {
      const rowIdx = shown.length - 1 - r;
      const base = r * NB_BINS * 4;
      for (let i = 0; i < NB_BINS; i++) {
        const o = base + i * 4;
        let v = 0;
        if (rowIdx >= 0) v = shown[rowIdx].data[i];
        const [cr, cg, cb] = color(v);
        img.data[o] = cr;
        img.data[o + 1] = cg;
        img.data[o + 2] = cb;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // freq grid
    const span = sim.nbSpan(tracker.arrayType);
    ctx.strokeStyle = 'rgba(120,160,160,0.15)';
    ctx.fillStyle = 'rgba(150,200,200,0.6)';
    ctx.font = '9px monospace';
    const stepHz = tracker.arrayType === 'towed' ? 50 : 200;
    for (let f = 0; f <= span.hi; f += stepHz) {
      const x = ((f - span.lo) / (span.hi - span.lo)) * NB_BINS;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ROWS_SHOWN);
      ctx.stroke();
      if (f > 0) ctx.fillText(`${f}`, x + 1, 9);
    }
  }, [tick, sim, tracker]);

  const info = tracker ? sim.nbInfo(tracker) : null;

  return (
    <div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={NB_BINS} height={ROWS_SHOWN} style={{ height: 150 }} />
        <div className="canvas-label">
          NARROWBAND GRAM {tracker ? `— ${tracker.label} (${tracker.arrayType.toUpperCase()})` : '— NO TRACKER SELECTED'}
        </div>
        <div className="canvas-sub">freq (Hz) →</div>
      </div>
      {info && (
        <div className="small" style={{ marginTop: 4 }}>
          {info.bladeRateHz ? (
            <span className="green">
              BLADE RATE {info.bladeRateHz.toFixed(2)} Hz ({info.harmonics} harmonic{info.harmonics === 1 ? '' : 's'})
            </span>
          ) : (
            <span className="dim">blade rate: not held</span>
          )}
          {info.strongestTonals.length > 0 && (
            <span className="dim">
              {'  '}| lines:{' '}
              {info.strongestTonals.map((t) => `${t.freq.toFixed(1)}Hz(${t.label})`).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
