import { useEffect, useRef } from 'react';
import { Simulation, BB_BINS } from '../sim/simulation';
import { ArrayType } from '../sim/types';
import { norm360 } from '../sim/geo';

const ROWS_SHOWN = 280;

/** phosphor-green colormap */
function color(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v));
  if (x < 0.5) {
    const k = x / 0.5;
    return [0, Math.round(30 + 130 * k), Math.round(10 + 40 * k)];
  }
  const k = (x - 0.5) / 0.5;
  return [Math.round(40 + 190 * k), Math.round(160 + 95 * k), Math.round(50 + 140 * k)];
}

interface Props {
  sim: Simulation;
  arrType: ArrayType;
  tick: number;
  onDesignate: (bearing: number) => void;
  selectedBearing?: number | null;
  height?: number;
}

export default function WaterfallDisplay({ sim, arrType, tick, onDesignate, selectedBearing, height = 190 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = sim.bbRows[arrType];
    const shown = rows.slice(-ROWS_SHOWN);
    const W = BB_BINS;
    const H = ROWS_SHOWN;
    const img = ctx.createImageData(W, H);
    for (let r = 0; r < H; r++) {
      const rowIdx = shown.length - 1 - r; // newest at top
      const base = r * W * 4;
      if (rowIdx < 0) {
        for (let i = 0; i < W; i++) {
          img.data[base + i * 4 + 3] = 255;
        }
        continue;
      }
      const data = shown[rowIdx].data;
      for (let i = 0; i < W; i++) {
        const [cr, cg, cb] = color(data[i]);
        const o = base + i * 4;
        img.data[o] = cr;
        img.data[o + 1] = cg;
        img.data[o + 2] = cb;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // overlays: bearing grid every 30 deg
    ctx.save();
    ctx.strokeStyle = 'rgba(120,160,140,0.18)';
    ctx.fillStyle = 'rgba(160,200,180,0.6)';
    ctx.font = '10px monospace';
    for (let b = 0; b < 360; b += 30) {
      const x = (b / 360) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillText(String(b).padStart(3, '0'), x + 2, 10);
    }
    // ownship course marker
    const cx = (norm360(sim.own.course) / 360) * W;
    ctx.strokeStyle = 'rgba(255,180,84,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, 8);
    ctx.stroke();

    // tracker markers
    for (const tr of sim.trackers) {
      if (tr.arrayType !== arrType || tr.marks.length === 0) continue;
      const b = tr.marks[tr.marks.length - 1].bearing;
      const x = (norm360(b) / 360) * W;
      ctx.fillStyle = tr.lost ? 'rgba(255,95,86,0.9)' : 'rgba(79,195,247,0.95)';
      ctx.fillRect(x - 1, 12, 3, 6);
      ctx.fillText(tr.label, x + 4, 20);
    }
    if (selectedBearing != null) {
      const x = (norm360(selectedBearing) / 360) * W;
      ctx.strokeStyle = 'rgba(79,195,247,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();
  }, [tick, sim, arrType, selectedBearing]);

  const arr = arrType === 'sphere' ? sim.sphere : sim.towed;
  const sub =
    arrType === 'towed'
      ? sim.towed.deployed
        ? `${arr.bandLo}-${arr.bandHi} Hz · stability ${(sim.towed.stability * 100).toFixed(0)}% · AMBIGUOUS`
        : `NOT DEPLOYED (${sim.towedStatus})`
      : `${arr.bandLo}-${arr.bandHi} Hz · baffles astern`;

  return (
    <div className="canvas-wrap" style={{ marginBottom: 8 }}>
      <canvas
        ref={canvasRef}
        width={BB_BINS}
        height={ROWS_SHOWN}
        style={{ height }}
        onClick={(e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const frac = (e.clientX - rect.left) / rect.width;
          onDesignate(norm360(frac * 360));
        }}
      />
      <div className="canvas-label">{arr.label} — BROADBAND BTR</div>
      <div className="canvas-sub">{sub}</div>
    </div>
  );
}
