import { Simulation } from '../sim/simulation';
import { fmtTime } from '../sim/geo';

export default function EventLog({ sim, tick }: { sim: Simulation; tick: number }) {
  const evts = [...sim.events].slice(-40).reverse();
  return (
    <div className="panel">
      <h3>EVENT LOG</h3>
      <div className="events">
        {evts.map((e, i) => (
          <div key={i}>
            <span className="t">{fmtTime(e.t)}</span>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
