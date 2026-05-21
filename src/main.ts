import { startRouter, registerScreen, type ScreenName } from './app/router';
import { HomeScreen } from './app/screens/home';
import { SandboxScreen } from './app/screens/sandbox';
// Other screens will be registered in later tasks.

registerScreen(HomeScreen);
registerScreen(SandboxScreen);

const root = document.getElementById('screen-root') as HTMLElement;
startRouter(root, screenFromUrl());

function screenFromUrl(): ScreenName {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen') as ScreenName | null;
  if (screen === 'sandbox') return 'sandbox';
  return 'home';
}
