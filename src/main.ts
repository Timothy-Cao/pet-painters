import { startRouter, registerScreen, type ScreenName } from './app/router';
import { HomeScreen } from './app/screens/home';
import { SandboxScreen } from './app/screens/sandbox';
import { SignInScreen } from './app/screens/sign-in';
import { LobbyScreen } from './app/screens/lobby';
import { RoomWaitingScreen } from './app/screens/room-waiting';
import { OnlineMatchScreen } from './app/screens/online-match';
import { SettingsScreen } from './app/screens/settings';
import { CrossingScreen } from './crossing/screen';
import { mountGlobalSettings } from './ui/global-settings';

registerScreen(HomeScreen);
registerScreen(SandboxScreen);
registerScreen(CrossingScreen);
registerScreen(SignInScreen);
registerScreen(LobbyScreen);
registerScreen(RoomWaitingScreen);
registerScreen(OnlineMatchScreen);
registerScreen(SettingsScreen);

mountGlobalSettings();

const root = document.getElementById('screen-root') as HTMLElement;
startRouter(root, screenFromUrl());

function screenFromUrl(): ScreenName {
  const params = new URLSearchParams(window.location.search);
  if (params.get('room')) return 'lobby';
  const screen = params.get('screen') as ScreenName | null;
  return screen ?? 'home';
}
