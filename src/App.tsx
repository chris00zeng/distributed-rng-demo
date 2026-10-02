import { RUNGS } from './content/rungs';

export function App() {
  return (
    <main className="app">
      <header className="masthead">
        <h1>Fair Rooms</h1>
        <p className="tagline">
          Four roommates. Four unequal rooms. One of them cheats. How do you roll the dice when
          nobody trusts anybody?
        </p>
      </header>
      <nav className="ladder" aria-label="Attack ladder">
        {RUNGS.map((rung) => (
          <span key={rung.id} className="rung rung--locked" title={rung.title}>
            {rung.id}
          </span>
        ))}
      </nav>
      <p className="placeholder">The ladder is under construction. Rung 0 arrives in PR3.</p>
    </main>
  );
}
