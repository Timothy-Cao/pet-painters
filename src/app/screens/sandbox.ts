import type { Screen } from '../router';
import { navigate } from '../router';

export const SandboxScreen: Screen = {
  name: 'sandbox',
  mount(root, params) {
    const isAI = params?.mode === 'ai';
    root.innerHTML = `
<div class="sandbox-screen" id="sandbox-container">
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">🎨</span>
        <span class="brand-name">Pet Painters</span>
        <span class="brand-mode">${isAI ? 'vs AI' : 'Sandbox'}</span>
      </div>
      <div class="phase-pill" id="phase-pill">
        <span class="phase-dot"></span>
        <span id="phase-text">Planning</span>
      </div>
      <div class="territory">
        <div class="territory-side territory-side-a">
          <div class="territory-tag">${isAI ? 'You' : 'A'}</div>
          <div class="territory-pct" id="pct-a">0%</div>
        </div>
        <div class="territory-bar">
          <div class="territory-fill territory-fill-a" id="fill-a"></div>
          <div class="territory-fill territory-fill-n" id="fill-n"></div>
          <div class="territory-fill territory-fill-b" id="fill-b"></div>
          <div class="threshold-marker threshold-a" title="Player A wins at this share"></div>
          <div class="threshold-marker threshold-b" title="Player B wins at this share"></div>
        </div>
        <div class="territory-side territory-side-b">
          <div class="territory-pct" id="pct-b">0%</div>
          <div class="territory-tag">${isAI ? 'AI' : 'B'}</div>
        </div>
      </div>
      <div class="settings-wrap">
        <button class="settings-btn" id="settings-btn" aria-label="Settings" aria-expanded="false" aria-haspopup="true">⚙</button>
        <div class="settings-menu" id="settings-menu" role="menu" hidden>
          <div class="settings-section-title">Accessibility</div>
          <label class="settings-row">
            <span>Colorblind palette</span>
            <input type="checkbox" id="settings-cb-palette" />
          </label>
          <div class="settings-hint">Swaps red → orange for deuteranopia / protanopia compatibility.</div>
          <div class="settings-section-title">Audio</div>
          <label class="settings-row">
            <span>Sound effects</span>
            <input type="checkbox" id="settings-cb-sound" />
          </label>
          <div class="settings-hint">Off by default. No audio files — all synthesized.</div>
        </div>
      </div>
    </header>

    <main class="layout">
      <aside class="sidebar sidebar-left">
        <div class="panel-title">Pet Roster</div>
        <div class="panel-hint">Choose a pet, then click any tile you own to deploy.</div>
        <div id="pet-roster" class="pet-roster"></div>

        <div class="panel-title panel-title-sm">Legend</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch swatch-a"></span> ${isAI ? 'Your' : 'Player A'} territory</div>
          <div class="legend-item"><span class="swatch swatch-b"></span> ${isAI ? 'AI' : 'Player B'} territory</div>
          <div class="legend-item"><span class="swatch swatch-n"></span> Neutral tile</div>
          <div class="legend-item"><span class="swatch swatch-home swatch-home-a">⫽</span> A home (locked)</div>
          <div class="legend-item"><span class="swatch swatch-home swatch-home-b">⫽</span> B home (locked)</div>
        </div>
      </aside>

      <section class="stage">
        <div class="canvas-frame">
          <div class="player-tag player-tag-b">${isAI ? '🤖 AI (top)' : 'Player B (top)'}</div>
          <canvas id="game" width="640" height="640"></canvas>
          <div class="player-tag player-tag-a">${isAI ? '🎮 You (bottom)' : 'Player A (bottom)'}</div>
          <div class="pet-inspect" id="pet-inspect" hidden>
            <div class="inspect-head">
              <span class="inspect-emoji" id="inspect-emoji">🐭</span>
              <span class="inspect-name" id="inspect-name">Mouse</span>
              <span class="inspect-owner-pill" id="inspect-owner">A</span>
              <button class="inspect-close" id="inspect-close" aria-label="Close">×</button>
            </div>
            <div class="inspect-stats">
              <div class="inspect-row">
                <span class="inspect-key">HP</span>
                <span class="inspect-val">
                  <span class="inspect-hp-bar"><span class="inspect-hp-fill" id="inspect-hp-fill"></span></span>
                  <span id="inspect-hp">3 / 3</span>
                </span>
              </div>
              <div class="inspect-row">
                <span class="inspect-key">Facing</span>
                <span class="inspect-val" id="inspect-facing">North</span>
              </div>
              <div class="inspect-row">
                <span class="inspect-key">Position</span>
                <span class="inspect-val" id="inspect-pos">(0, 0)</span>
              </div>
            </div>
            <div class="inspect-blurb" id="inspect-blurb"></div>
            <button class="btn-secondary inspect-undeploy" id="inspect-undeploy">Undeploy</button>
          </div>
          <div class="round-summary" id="round-summary" hidden>
            <div class="rs-head">
              <span class="rs-title">Round <span id="rs-round">1</span> complete</span>
              <button class="rs-close" id="rs-close" aria-label="Dismiss">×</button>
            </div>
            <div class="rs-cols">
              <div class="rs-col rs-col-a">
                <div class="rs-col-tag">A</div>
                <div class="rs-stats">
                  <div class="rs-stat"><span>Tiles</span><span class="rs-delta" id="rs-a-delta">+0</span></div>
                  <div class="rs-stat"><span>Total</span><span class="rs-total" id="rs-a-total">0</span></div>
                  <div class="rs-stat"><span>Pets lost</span><span class="rs-lost" id="rs-a-lost">0</span></div>
                </div>
              </div>
              <div class="rs-momentum">
                <div class="rs-momentum-arrow" id="rs-momentum-arrow"></div>
                <div class="rs-momentum-label" id="rs-momentum-label">Even</div>
              </div>
              <div class="rs-col rs-col-b">
                <div class="rs-col-tag">B</div>
                <div class="rs-stats">
                  <div class="rs-stat"><span>Tiles</span><span class="rs-delta" id="rs-b-delta">+0</span></div>
                  <div class="rs-stat"><span>Total</span><span class="rs-total" id="rs-b-total">0</span></div>
                  <div class="rs-stat"><span>Pets lost</span><span class="rs-lost" id="rs-b-lost">0</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="exec-bar" id="exec-bar">
          <div class="exec-fill" id="exec-fill"></div>
          <div class="exec-label" id="exec-label">Execution 0.0s / 8.0s</div>
        </div>
      </section>

      <aside class="sidebar sidebar-right">
        <div class="panel-title">Facing</div>
        <div class="facing-row">
          <div class="facing-display" id="facing-display">
            <div class="facing-arrow" id="facing-arrow">▲</div>
            <div class="facing-name" id="facing-name">North</div>
          </div>
          <button class="btn-rotate" id="btn-rotate" title="Rotate clockwise">
            <span class="rotate-icon">⟳</span>
            <span class="rotate-label">Rotate</span>
            <span class="btn-hotkey">R</span>
          </button>
        </div>

        <div class="panel-title">Tactical</div>
        <div class="tactical">
          <div class="tac-row tac-row-tick" id="tac-tick-row">
            <span class="tac-label">Exec tick</span>
            <span class="tac-value"><span id="tac-tick">0</span> <span class="tac-of">/ <span id="tac-tick-total">160</span></span></span>
          </div>
          <div class="tac-row">
            <span class="tac-label">Deployed</span>
            <span class="tac-deploy">
              <span class="tac-deploy-pill tac-deploy-a"><span class="tac-deploy-dot dot-a"></span><span id="tac-deploy-a">0</span></span>
              <span class="tac-deploy-pill tac-deploy-b"><span class="tac-deploy-dot dot-b"></span><span id="tac-deploy-b">0</span></span>
            </span>
          </div>
          <div class="tac-events-head">Recent events</div>
          <ul class="tac-events" id="tac-events">
            <li class="tac-events-empty">No events yet</li>
          </ul>
        </div>

        <div class="panel-title">Energy</div>
        <div class="energy-row">
          <div class="energy-cell energy-a">
            <div class="energy-label">${isAI ? 'You' : 'A'}</div>
            <div class="energy-val" id="energy-a">${isAI ? '3' : '∞'}</div>
          </div>
          <div class="energy-cell energy-b">
            <div class="energy-label">${isAI ? 'AI' : 'B'}</div>
            <div class="energy-val" id="energy-b">${isAI ? '3' : '∞'}</div>
          </div>
        </div>

        <div class="action-area">
          <button class="btn-primary" id="btn-start">
            ▶ Start Round
            <span class="btn-hotkey-light">Space</span>
          </button>
          <button class="btn-secondary" id="btn-reset">
            ⟲ Reset Match
            <span class="btn-hotkey-light">R</span>
          </button>
        </div>
      </aside>
    </main>

    <footer class="footer">
      <span><kbd>1</kbd>–<kbd>9</kbd>,<kbd>0</kbd> select pet</span>
      <span><kbd>R</kbd> or <kbd>right-click</kbd> rotate</span>
      <span><kbd>Left-click</kbd> deploy on own tile</span>
      <span><kbd>Left-click</kbd> on pet to undeploy</span>
      <span><kbd>Space</kbd> start round</span>
    </footer>
  </div>

  <div class="win-overlay" id="win-overlay" hidden>
    <div class="win-confetti" id="win-confetti"></div>
    <div class="win-card">
      <div class="win-eyebrow">Match complete</div>
      <div class="win-headline" id="win-headline">
        Player <span id="win-winner">A</span> wins
      </div>
      <div class="win-recap">
        <div class="win-recap-side">
          <span class="win-recap-tag win-recap-tag-a">${isAI ? 'You' : 'A'}</span>
          <span class="win-recap-val" id="win-recap-a">0%</span>
        </div>
        <div class="win-recap-vs">vs</div>
        <div class="win-recap-side">
          <span class="win-recap-tag win-recap-tag-b">${isAI ? 'AI' : 'B'}</span>
          <span class="win-recap-val" id="win-recap-b">0%</span>
        </div>
      </div>
      <div class="win-actions">
        <button class="btn-primary" id="win-rematch">▶ Play Again</button>
        <button class="btn-secondary" id="win-home">← Back to Home</button>
      </div>
    </div>
  </div>
</div>
    `;

    const container = root.querySelector('#sandbox-container') as HTMLElement;

    // Scope sandbox-ui and win-overlay DOM queries to this container.
    import('../../ui/sandbox-ui').then(({ setSandboxRoot }) => {
      setSandboxRoot(container);
    });
    import('../../ui/win-overlay').then(({ setWinOverlayRoot }) => {
      setWinOverlayRoot(container);
    });

    // Wire win overlay secondary button (always available, no async needed).
    container.querySelector('#win-home')?.addEventListener('click', () => navigate('home'));

    // Boot the full sandbox within the container.
    import('../../ui/sandbox-boot').then(({ bootSandbox }) => {
      bootSandbox(container, isAI ? { withAI: true } : undefined);
    });

    // Back button overlay.
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Home';
    backBtn.addEventListener('click', () => navigate('home'));
    root.appendChild(backBtn);

    // No Escape-to-navigate — use the ← Home button instead.
    // Escape is handled by sandbox-boot (deselect inspector / pet selection only).
  },
};
