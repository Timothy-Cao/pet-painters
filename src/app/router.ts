import { setMusicCategory } from '../render/audio';

export type ScreenName =
  | 'home'
  | 'sandbox'
  | 'crossing'
  | 'sign-in'
  | 'lobby'
  | 'room-waiting'
  | 'online-match'
  | 'settings';

export interface Screen {
  name: ScreenName;
  mount(root: HTMLElement, params?: Record<string, string>): void | (() => void);
}

const REGISTRY: Map<ScreenName, Screen> = new Map();

export function registerScreen(s: Screen): void { REGISTRY.set(s.name, s); }

let currentUnmount: (() => void) | null = null;
let root: HTMLElement | null = null;

/** Screens that should play gameplay music; everything else gets menu music. */
const GAMEPLAY_SCREENS: Set<ScreenName> = new Set(['sandbox', 'online-match', 'crossing']);

export function startRouter(rootEl: HTMLElement, initial: ScreenName = 'home'): void {
  root = rootEl;
  navigate(initial);
  window.addEventListener('popstate', () => navigate(currentScreenFromUrl()));
}

export function navigate(name: ScreenName, params: Record<string, string> = {}): void {
  if (!root) throw new Error('router not started');
  if (currentUnmount) currentUnmount();
  root.innerHTML = '';
  const screen = REGISTRY.get(name);
  if (!screen) throw new Error(`unknown screen: ${name}`);
  const unmount = screen.mount(root, params);
  currentUnmount = typeof unmount === 'function' ? unmount : null;

  // Switch music category based on screen type.
  setMusicCategory(GAMEPLAY_SCREENS.has(name) ? 'gameplay' : 'menu');

  const url = new URL(window.location.href);
  url.searchParams.delete('screen');
  url.searchParams.delete('room');
  if (name !== 'home') url.searchParams.set('screen', name);
  if (params.room) url.searchParams.set('room', params.room);
  window.history.pushState({}, '', url.toString());
}

function currentScreenFromUrl(): ScreenName {
  const url = new URL(window.location.href);
  const name = url.searchParams.get('screen') as ScreenName | null;
  return name && REGISTRY.has(name) ? name : 'home';
}
