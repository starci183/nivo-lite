import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingChannels } from "@/components/blocks/OnboardingChannels"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import type { FirstRunRail } from "@/components/frames/FirstRunStep"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"

/** Copy the /workspaces/new/channels page supplies. */
export interface WorkspaceChannelsPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** The words of the step rail. */
        readonly rail: FirstRunRail
    }
}

/** Draws the second step of the first-run wizard: the channels customers write on, with the connection wizard drawer. */
export const WorkspaceChannelsPageBase = (props: WorkspaceChannelsPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s1"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-channels-3d.webp"
                    size="sm"
                    loading="eager"
                    assetSlot="onboarding-channels"
                    assetSha256="8889ddfb545665a93bb56c55b4e430d0350c6df6a0352c8f89c81ded7d84d3c1"
                    assetPrompt="Three floating rounded pure 3D chat bubbles, blue, sky blue and teal green with a small golden coin, soft clay render, no characters, transparent ground"
                />
            }
        >
            <OnboardingChannels />
            <ConnectionWizardOverlay />
        </FirstRunStep>
    </Page>
)
