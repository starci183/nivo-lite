import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingReady } from "@/components/blocks/OnboardingReady"
import { FirstRunStep } from "@/components/composites/FirstRunStep"

/** Copy the /workspaces/new/done page supplies. */
export interface WorkspaceReadyPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
    }
}

/** Draws the end of the first-run wizard: the workspace is ready, with the way in. */
export const WorkspaceReadyPageBase = (props: WorkspaceReadyPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            currentStepId="s3"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-done.webp"
                    size="lg"
                    loading="eager"
                    assetSlot="onboarding-done"
                    assetSha256="0ba20963eb51e1c739572fee20fdb0e00fcff24937dfde30857337491943d861"
                    assetPrompt="The NIVO unicorn leaps in celebration with red and pink confetti and a few golden stars, transparent ground"
                />
            }
        >
            <OnboardingReady />
        </FirstRunStep>
    </Page>
)
