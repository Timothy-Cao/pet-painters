import { startRouter, registerScreen, type ScreenName } from './app/router';
import { HomeScreen } from './app/screens/home';
import { SandboxScreen } from './app/screens/sandbox';
import { SignInScreen } from './app/screens/sign-in';
import { LobbyScreen } from './app/screens/lobby';
// Other screens will be registered in later tasks.

registerScreen(HomeScreen);
registerScreen(SandboxScreen);
registerScreen(SignInScreen);
registerScreen(LobbyScreen);

const root = document.getElementById('screen-root') as HTMLElement;
startRouter(root, screenFromUrl());

function screenFromUrl(): ScreenName {
  const params = new URLSearchParams(window.location.search);
  if (params.get('room')) return 'lobby';
  const screen = params.get('screen') as ScreenName | null;
  return screen ?? 'home';
}
