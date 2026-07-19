import { useState } from 'react';
import { Simulation } from '../sim/simulation';
import { selfNoise } from '../sim/sonar';

interface Props {
  sim: Simulation;
  tick: number;
}

export default function ShipControl({ sim, tick }: Props) {
  const [c, setC] = useState<string>('');
  const [s, setS] = useState<string>('');
  const [d, setD] = useState<string>('');
  const own = sim.own;
  const layer = sim.env.layerDepthFt;
  const belowLayer = own.depth > layer;
  const noise = selfNoise(own.speed, 'sphere');
  const noiseState = own.speed <= 6 ? 'QUIET' : own.speed <= 12 ? 'MODERATE' : 'LOUD';

  return (
    <div className="panel">
      <h3>SHIP CONTROL — {sim.ownPlatform.shortName.toUpperCase()}</h3>
      <div className="kv">
        <span className="k">course</span>
        <span className="v green">{String(Math.round(own.course)).padStart(3, '0')}</span>
      </div>
      <div className="kv">
        <span className="k">speed</span>
        <span className="v green">{own.speed.toFixed(1)} kts</span>
      </div>
      <div className="kv">
        <span className="k">depth</span>
        <span className="v green">
          {Math.round(own.depth)} ft {layer > 0 ? (belowLayer ? '(below layer)' : '(above layer)') : ''}
        </span>
      </div>
      <div className="kv">
        <span className="k">own noise</span>
        <span className={`v ${noiseState === 'QUIET' ? 'green' : noiseState === 'MODERATE' ? 'amber' : 'red'}`}>
          {noiseState} ({noise.toFixed(0)} dB)
        </span>
      </div>
      <hr className="sep" />
      <div className="row">
        <label>course</label>
        <input type="number" placeholder={String(Math.round(own.orderedCourse))} value={c} onChange={(e) => setC(e.target.value)} />
        <button
          onClick={() => {
            if (c !== '') sim.orderCourse(Number(c));
            setC('');
          }}
        >
          ORDER
        </button>
      </div>
      <div className="row">
        <label>speed</label>
        <input type="number" placeholder={String(own.orderedSpeed)} value={s} onChange={(e) => setS(e.target.value)} />
        <button
          onClick={() => {
            if (s !== '') sim.orderSpeed(Number(s));
            setS('');
          }}
        >
          ORDER
        </button>
      </div>
      <div className="row">
        <label>depth</label>
        <input type="number" placeholder={String(own.orderedDepth)} value={d} onChange={(e) => setD(e.target.value)} />
        <button
          onClick={() => {
            if (d !== '') sim.orderDepth(Number(d));
            setD('');
          }}
        >
          ORDER
        </button>
      </div>
      <hr className="sep" />
      <div className="row">
        <label>towed</label>
        <span className={sim.towed.deployed ? 'green' : 'dim'}>{sim.towedStatus}</span>
        <span className="spacer" />
        <button onClick={() => sim.toggleTowed()}>{sim.towed.deployed ? 'RETRIEVE' : 'STREAM'}</button>
      </div>
      <div className="help-block">
        Max speed ~{sim.ownPlatform.maxSpeedKts} kts · test depth ~{sim.ownPlatform.testDepthFt} ft (public est.)
      </div>
      <div className="help-block">
        Layer depth: {layer > 0 ? `${layer} ft` : 'none'} · water: {sim.env.waterDepthFt} ft · SS{sim.env.seaState} ·{' '}
        {sim.env.name}
      </div>
    </div>
  );
}
