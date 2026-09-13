import { AuthGate } from './auth/AuthGate'
import ChatApp from './chat/ChatApp'
import WindowFrameTitleBar from './desktop/WindowFrameTitleBar'
import { OnboardingGate } from './onboarding/OnboardingWizard'
import PlatformAlertsHost from './platform/PlatformAlertsHost'
import SystemUpdateHost from './system-update/SystemUpdateHost'
import { ThemeStudioPanel } from './theme/ThemeStudioPanel'

export default function App() {
  return (
    <>
      <WindowFrameTitleBar />
      <SystemUpdateHost />
      <ThemeStudioPanel />
      <AuthGate>
        <PlatformAlertsHost />
        <OnboardingGate>
          <ChatApp />
        </OnboardingGate>
      </AuthGate>
    </>
  )
}
