import { Page } from "@starci/grammar/common"
import { OnboardingHandover } from "@/components/blocks/OnboardingHandover"
import { FirstRunStep } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new/ai page supplies. */
export interface WorkspaceHandoverPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** One short line under each step label. */
        readonly descriptions: ReadonlyArray<string>
    }
}

/** Draws the third step of the first-run wizard: how customers are handed to the AI. */
export const WorkspaceHandoverPageBase = (props: WorkspaceHandoverPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            descriptions={props.props.descriptions}
            currentStepId="s2"
        >
            <OnboardingHandover />
        </FirstRunStep>
    </Page>
)
