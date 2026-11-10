import { Page } from "@starci/grammar/common"
import { OnboardingReady } from "@/components/blocks/OnboardingReady"

/** Draws the end of the first-run wizard: the workspace is ready, celebrated, with the first steps and the way in. */
export const WorkspaceReadyPageBase = () => (
    <Page measure="product">
        <OnboardingReady />
    </Page>
)
