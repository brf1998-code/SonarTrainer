import { useState } from 'react';
import { Simulation } from '../sim/simulation';
import { Tutorial } from '../tutorials/tutorials';

interface Props {
  sim: Simulation;
  tick: number;
  tutorial: Tutorial;
  stepIdx: number;
  onAdvance: () => void;
}

export default function TutorialPanel({ sim, tick, tutorial, stepIdx, onAdvance }: Props) {
  const [showHint, setShowHint] = useState(false);
  const step = tutorial.steps[stepIdx];
  if (!step) return null;
  const isLast = stepIdx === tutorial.steps.length - 1;
  const passed = step.check(sim);

  return (
    <div className="panel" style={{ borderColor: 'var(--amber)' }}>
      <h3>
        TUTORIAL — {tutorial.name.toUpperCase()} ({stepIdx + 1}/{tutorial.steps.length})
      </h3>
      <div className="tutorial-step-title">{step.title}</div>
      <div className="tutorial-text">{step.text}</div>
      {showHint && step.hint && <div className="hint">HINT: {step.hint}</div>}
      <div className="row">
        {step.hint && (
          <button onClick={() => setShowHint(!showHint)}>{showHint ? 'HIDE HINT' : 'HINT'}</button>
        )}
        <span className="spacer" />
        {!isLast && (
          <>
            {passed ? <span className="green">✓ step complete</span> : <span className="dim">…working</span>}
            <button
              disabled={!passed}
              className={passed ? 'active' : ''}
              onClick={() => {
                setShowHint(false);
                onAdvance();
              }}
            >
              NEXT
            </button>
          </>
        )}
        {isLast && <span className="green">TUTORIAL COMPLETE</span>}
      </div>
    </div>
  );
}
