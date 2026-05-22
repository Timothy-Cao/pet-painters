/**
 * tutorial.ts
 *
 * First-time tutorial overlay — a 4-step slideshow that introduces
 * new players to Pet Painters.  Shown once, tracked via localStorage.
 */

const LS_KEY = 'pet-painters-tutorial-seen';

interface TutorialStep {
  icon: string;
  title: string;
  body: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: '\u{1F3A8}', // 🎨
    title: 'Welcome to Pet Painters!',
    body: 'Deploy emoji pets on a 20×20 board. They walk and paint tiles in your color. Control 60% of the board to win!',
  },
  {
    icon: '\u{1F43E}', // 🐾
    title: 'Deploy Pets',
    body: 'Pick a pet from the roster on the left. Click any tile in YOUR colored territory to place it. Press R to rotate facing direction.',
  },
  {
    icon: '▶️', // ▶️
    title: 'Start the Round',
    body: 'Press SPACE or click Ready when you’re done deploying. In online play, both players must ready up. Pets then move and fight for 8 seconds.',
  },
  {
    icon: '\u{1F3C6}', // 🏆
    title: 'Win the Game',
    body: 'Each pet paints tiles as it walks. Predators hunt enemies. Tanks hold ground. Check the territory bar at the top — first to 60% wins!',
  },
];

/**
 * Show the tutorial overlay if the player hasn't dismissed it yet.
 * Safe to call on every boot — it no-ops when the flag is already set.
 */
export function maybeShowTutorial(
  container: HTMLElement,
  _viewer?: 'A' | 'B' | null,
): void {
  if (localStorage.getItem(LS_KEY)) return;
  showTutorial(container);
}

/**
 * Force-show the tutorial (used by the "How to Play" button on the home screen).
 */
export function showTutorial(container: HTMLElement): void {
  let current = 0;

  // ---------- Build DOM ----------
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';

  const card = document.createElement('div');
  card.className = 'tutorial-card';
  overlay.appendChild(card);

  // Step content area
  const stepIcon = document.createElement('div');
  stepIcon.className = 'tutorial-step-icon';

  const stepTitle = document.createElement('div');
  stepTitle.className = 'tutorial-step-title';

  const stepBody = document.createElement('div');
  stepBody.className = 'tutorial-step-body';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'tutorial-content';
  contentWrap.append(stepIcon, stepTitle, stepBody);
  card.appendChild(contentWrap);

  // Dots
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'tutorial-dots';
  STEPS.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'tutorial-dot';
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  card.appendChild(dotsWrap);

  // Navigation row
  const nav = document.createElement('div');
  nav.className = 'tutorial-nav';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'tutorial-skip';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', dismiss);

  const backBtn = document.createElement('button');
  backBtn.className = 'tutorial-btn tutorial-btn-back';
  backBtn.textContent = 'Back';
  backBtn.addEventListener('click', () => goTo(current - 1));

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tutorial-btn tutorial-btn-next';
  nextBtn.addEventListener('click', () => {
    if (current === STEPS.length - 1) {
      dismiss();
    } else {
      goTo(current + 1);
    }
  });

  nav.append(skipBtn, backBtn, nextBtn);
  card.appendChild(nav);

  // "Don't show again" checkbox
  const checkLabel = document.createElement('label');
  checkLabel.className = 'tutorial-remember';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  const checkText = document.createTextNode(' Don’t show again');
  checkLabel.append(checkbox, checkText);
  card.appendChild(checkLabel);

  // ---------- Helpers ----------
  function goTo(step: number) {
    current = Math.max(0, Math.min(step, STEPS.length - 1));
    render();
  }

  function render() {
    const s = STEPS[current];
    stepIcon.textContent = s.icon;
    stepTitle.textContent = s.title;
    stepBody.textContent = s.body;

    // Dots
    const dots = dotsWrap.querySelectorAll('.tutorial-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === current));

    // Navigation state
    backBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = current === STEPS.length - 1 ? 'Got it!' : 'Next';
    nextBtn.classList.toggle('tutorial-btn-finish', current === STEPS.length - 1);
    skipBtn.style.display = current === STEPS.length - 1 ? 'none' : '';
  }

  function dismiss() {
    if (checkbox.checked) {
      localStorage.setItem(LS_KEY, '1');
    }
    overlay.classList.add('tutorial-overlay-out');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    // Fallback removal in case animationend doesn't fire (reduced-motion).
    setTimeout(() => overlay.remove(), 400);
  }

  // Close on backdrop click (but not card click).
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  // Keyboard: Escape to close, arrows to navigate.
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { dismiss(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { goTo(current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { goTo(current - 1); }
  }
  window.addEventListener('keydown', onKey);
  // Cleanup listener when overlay is removed.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      window.removeEventListener('keydown', onKey);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ---------- Mount ----------
  render();
  container.appendChild(overlay);
}
