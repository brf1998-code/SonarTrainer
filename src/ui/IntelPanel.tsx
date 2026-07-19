import { useState } from 'react';
import { PLATFORMS, Platform, Nation } from '../sim/platforms';

const NATION_LABEL: Record<Nation, string> = {
  US: 'UNITED STATES',
  RU: 'RUSSIA',
  CN: 'CHINA',
  CIV: 'CIVILIAN',
};

function Tier({ n }: { n: number }) {
  return (
    <span title="relative quieting (public assessments): 5 = quietest">
      {'▰'.repeat(n)}
      {'▱'.repeat(5 - n)}
    </span>
  );
}

function PlatformCard({ p }: { p: Platform }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel" style={{ marginBottom: 6 }}>
      <div className="row" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span className="green">{p.shortName}</span>
        <span className="dim">{p.type}</span>
        <span className="spacer" />
        <span className="amber small">
          quieting <Tier n={p.quietingTier} />
        </span>
        <span className="dim">{open ? '▾' : '▸'}</span>
      </div>
      <div className="kv small">
        <span className="k">{p.name}</span>
      </div>
      <div className="kv small">
        <span className="k">
          {p.displacementTons.toLocaleString()} t · {p.lengthM} m · max ~{p.maxSpeedKts} kts
          {p.testDepthFt ? ` · test depth ~${p.testDepthFt} ft (public est.)` : ''}
        </span>
      </div>
      <div className="kv small">
        <span className="k">
          {p.propulsion} · {p.propulsor.kind}
          {p.propulsor.blades ? ` (${p.propulsor.blades} blades)` : ''} · {p.propulsor.shafts} shaft
          {p.propulsor.shafts > 1 ? 's' : ''}
        </span>
      </div>
      {open && (
        <div className="help-block">
          <div style={{ marginBottom: 4 }}>{p.quietingNote}</div>
          <div style={{ marginBottom: 4 }}>Propulsor: {p.propulsor.note}</div>
          {p.sonarFit.length > 0 && <div style={{ marginBottom: 4 }}>Sonar fit: {p.sonarFit.join('; ')}</div>}
          {p.notes && <div style={{ marginBottom: 4 }}>{p.notes}</div>}
          <div>
            Sources:{' '}
            {p.sources.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', marginRight: 6 }}>
                [{i + 1}]
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelPanel() {
  const [nation, setNation] = useState<Nation | 'ALL'>('ALL');
  const shown = PLATFORMS.filter((p) => nation === 'ALL' || p.nation === nation);
  return (
    <div>
      <div className="row">
        <span className="dim">INTEL LIBRARY — open-source platform reference</span>
        <span className="spacer" />
        {(['ALL', 'US', 'RU', 'CN', 'CIV'] as const).map((n) => (
          <button key={n} className={n === nation ? 'active' : ''} onClick={() => setNation(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="help-block" style={{ marginBottom: 8 }}>
        Hull, speed, depth, propulsor, and quieting assessments compiled from public sources (Covert Shores,
        Wikipedia, FAS, USNI, CRS, GlobalSecurity, naval-technology) — click a card for details and citations.
        In-sim acoustic behavior is a gameplay model derived only from these public relative assessments;
        no real measured signature data exists in this trainer.
      </div>
      {(['US', 'RU', 'CN', 'CIV'] as Nation[])
        .filter((n) => nation === 'ALL' || nation === n)
        .map((n) => (
          <div key={n}>
            <h3 style={{ color: 'var(--dim)', letterSpacing: 2, borderBottom: '1px solid var(--border)' }}>
              {NATION_LABEL[n]}
            </h3>
            {shown
              .filter((p) => p.nation === n)
              .map((p) => (
                <PlatformCard key={p.id} p={p} />
              ))}
          </div>
        ))}
    </div>
  );
}
