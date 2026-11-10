import { Page } from "@starci/grammar/common"
import { OnboardingChannels } from "@/components/blocks/OnboardingChannels"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"

/** Copy the /workspaces/new/channels page supplies. */
export interface WorkspaceChannelsPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** One short line under each step label. */
        readonly descriptions: ReadonlyArray<string>
    }
}

/** Draws the second step of the first-run wizard: the channels customers write on, with the connection wizard drawer. */
export const WorkspaceChannelsPageBase = (props: WorkspaceChannelsPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            descriptions={props.props.descriptions}
            currentStepId="s1"
        >
            <OnboardingChannels />
            <ConnectionWizardOverlay />
        </FirstRunStep>
    </Page>
)
