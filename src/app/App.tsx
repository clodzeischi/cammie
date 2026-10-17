import { AppShell } from './AppShell';
import { MobileGate } from './MobileGate';
import { useScreenTooSmall } from './screenGate';

export function App() {
  return useScreenTooSmall() ? <MobileGate /> : <AppShell />;
}
