import { useEffect, useRef, useState } from 'react';
import { Simulation } from '../sim/simulation';
import { Tracker } from '../sim/types';
import { solutionPosAt } from '../sim/tma';
import { DEG } from '../sim/constants';
import { PLATFORMS } from '../sim/platforms';

function truthLabel(name: string, platformId: string | undefined, cls: string): string {
  const p = platformId ? PLATFORMS.find((x) => x.id === platformId) : undefined;
  return `${name} (${p ? p.shortName : cls})`;
}

const SIZE = 640;
const ZOOMS = [5000, 10000, 20000, 40000, 80000]; // radius yards

interface Props {
  sim: Simulation;
  tick: number;
  truthMode: boolean;
  selectedTracker: Tracker | null;
}

export default function GeoPlot({ sim, tick, truthMode, selectedTracker }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomIdx, setZoomIdx] = useState(2);
  const radius = ZOOMS[zoomIdx];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = SIZE / 2 / radius; // px per yard
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const toPx = (x: number, y: number): [number, number] => [
      cx + (x - sim.own.pos.x) * scale,
      cy - (y - sim.own.pos.y) * scale,
    ];

    ctx.fillStyle = '#040a0e';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // range rings
    ctx.strokeStyle = 'rgba(70,110,95,0.3)';
    ctx.fillStyle = 'rgba(120,170,150,0.5)';
    ctx.font = '10px monospace';
    const ringStep = radius / 4;
    for (let r = ringStep; r <= radius; r += ringStep) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${(r / 1000).toFixed(0)}k`, cx + r * scale + 2, cy - 2);
    }
    // north marker
    ctx.fillStyle = 'rgba(160,200,180,0.8)';
    ctx.fillText('N', cx - 3, 12);

    // ownship track
    ctx.strokeStyle = 'rgba(60,233,126,0.5)';
    ctx.beginPath();
    let started = false;
    for (const h of sim.ownHistory) {
      const [px, py] = toPx(h.pos.x, h.pos.y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // bearing fans for selected tracker
    if (selectedTracker) {
      const marks = selectedTracker.marks;
      const stride = Math.max(1, Math.floor(marks.length / 24));
      for (let i = 0; i < marks.length; i += stride) {
        const m = marks[i];
        const age = (sim.t - m.t) / Math.max(60, sim.t - (marks[0]?.t ?? 0));
        const alpha = 0.35 * (1 - Math.min(1, age)) + 0.06;
        ctx.strokeStyle = `rgba(79,195,247,${alpha.toFixed(3)})`;
        const [ox, oy] = toPx(m.ownPos.x, m.ownPos.y);
        const bx = m.ownPos.x + Math.sin(m.bearing * DEG) * radius * 2;
        const by = m.ownPos.y + Math.cos(m.bearing * DEG) * radius * 2;
        const [ex, ey] = toPx(bx, by);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    // solutions
    for (const tr of sim.trackers) {
      if (!tr.solution) continue;
      const p = solutionPosAt(tr.solution, sim.t);
      const [px, py] = toPx(p.x, p.y);
      const sel = tr === selectedTracker;
      ctx.strokeStyle = sel ? '#4fc3f7' : 'rgba(79,195,247,0.6)';
      ctx.strokeRect(px - 5, py - 5, 10, 10);
      // velocity leader (6 min)
      const vx = Math.sin(tr.solution.course * DEG) * tr.solution.speed * 33.756 * 6;
      const vy = Math.cos(tr.solution.course * DEG) * tr.solution.speed * 33.756 * 6;
      const [lx, ly] = toPx(p.x + vx, p.y + vy);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(tr.label, px + 8, py - 6);
    }

    // truth
    if (truthMode) {
      for (const c of sim.contacts) {
        const [px, py] = toPx(c.ship.pos.x, c.ship.pos.y);
        ctx.strokeStyle = '#ffb454';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.stroke();
        const vx = Math.sin(c.ship.course * DEG) * c.ship.speed * 33.756 * 6;
        const vy = Math.cos(c.ship.course * DEG) * c.ship.speed * 33.756 * 6;
        const [lx, ly] = toPx(c.ship.pos.x + vx, c.ship.pos.y + vy);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.fillStyle = '#ffb454';
        ctx.fillText(truthLabel(c.ship.name, c.ship.signature.platformId, c.ship.contactClass), px + 8, py + 12);
      }
    }

    // ownship symbol
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sim.own.course * DEG);
    ctx.strokeStyle = '#3ce97e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(4, 6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }, [tick, sim, truthMode, selectedTracker, radius]);

  return (
    <div>
      <div className="row">
        <span className="dim">GEOGRAPHIC PLOT — ownship centered</span>
        <span className="spacer" />
        <button onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))}>+</button>
        <span className="dim">{(radius / 1000).toFixed(0)} kyd</span>
        <button onClick={() => setZoomIdx(Math.min(ZOOMS.length - 1, zoomIdx + 1))}>−</button>
      </div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ maxHeight: '70vh', imageRendering: 'auto' }} />
      </div>
      <div className="help-block">
        Cyan fans: bearing history for the selected tracker. Cyan squares: your solutions (6-min leader).
        {truthMode ? ' Amber: TRUTH (instructor mode).' : ' Toggle TRUTH in the top bar to grade yourself.'}
      </div>
    </div>
  );
}
