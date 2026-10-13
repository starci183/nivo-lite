import { OnboardingRedirectPage } from "@/features/pages/OnboardingRedirectPage"

export { workspacesMetadata as generateMetadata } from "@/features/pages/WorkspacesPage"

/** The old entry point: the workspaces area replaced it. */
const Page = () => <OnboardingRedirectPage target="/workspaces" />

export default Page
