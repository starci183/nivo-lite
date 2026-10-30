import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingChannels } from "@/components/blocks/OnboardingChannels"
import { FirstRunStep } from "@/components/composites/FirstRunStep"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"

/** Copy the /workspaces/new/channels page supplies. */
export interface WorkspaceChannelsPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
    }
}

/** Draws the second step of the first-run wizard: the channels customers write on, with the connection wizard drawer. */
export const WorkspaceChannelsPageBase = (props: WorkspaceChannelsPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            currentStepId="s1"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-channels.webp"
                    size="lg"
                    loading="eager"
                    assetSlot="onboarding-channels"
                    assetSha256="e0153ebab0414d8c75209691cb02a5c755ba4b6a75283894d10f04c8b2b4d88e"
                    assetPrompt="The NIVO unicorn juggles three floating rounded chat bubbles (blue, sky blue, green with a small coin), transparent ground"
                />
            }
        >
            <OnboardingChannels />
            <ConnectionWizardOverlay />
        </FirstRunStep>
    </Page>
)
