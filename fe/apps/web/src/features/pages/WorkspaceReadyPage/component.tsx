import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingReady } from "@/components/blocks/OnboardingReady"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import type { FirstRunRail } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new/done page supplies. */
export interface WorkspaceReadyPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** The words of the step rail. */
        readonly rail: FirstRunRail
    }
}

/** Draws the end of the first-run wizard: the workspace is ready, with the way in. */
export const WorkspaceReadyPageBase = (props: WorkspaceReadyPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s3"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-done-3d.webp"
                    size="md"
                    loading="eager"
                    assetSlot="onboarding-done"
                    assetSha256="ca22f750eb5c5bdbaa6b6bab882a7d3a4fa4bb1321a61232ba1d533b08dd832e"
                    assetPrompt="A large rose pure 3D check mark badge with rose and pink confetti and small golden stars, soft clay render, no characters, transparent ground"
                />
            }
        >
            <OnboardingReady />
        </FirstRunStep>
    </Page>
)
