import { AuthGate } from './auth/AuthGate'
import ChatApp from './chat/ChatApp'
import ResearchBoardSnapshotPage from './chat/research-canvas/ResearchBoardSnapshotPage'
import { WorkspaceUiProvider } from './chat/workspace/WorkspaceUiProvider'
import WindowFrameTitleBar from './desktop/WindowFrameTitleBar'
import { OnboardingGate } from './onboarding/OnboardingWizard'
import PlatformAlertsHost from './platform/PlatformAlertsHost'
import SystemUpdateHost from './system-update/SystemUpdateHost'
import { ThemeStudioPanel } from './theme/ThemeStudioPanel'
import { readBoardSnapshotDeepLink } from './utils/boardSnapshotDeepLink'

export default function App() {
  const snapshotId = readBoardSnapshotDeepLink()
  if (snapshotId) {
    return (
      <WorkspaceUiProvider>
        <ResearchBoardSnapshotPage snapshotId={snapshotId} />
      </WorkspaceUiProvider>
    )
  }

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
