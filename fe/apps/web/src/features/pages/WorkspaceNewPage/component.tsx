import { Page } from "@starci/grammar/common"
import { WorkspaceCreate } from "@/components/blocks/WorkspaceCreate"
import { FirstRunStep } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new page supplies. */
export interface WorkspaceNewPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** One short line under each step label. */
        readonly descriptions: ReadonlyArray<string>
    }
}

/** Draws the first step of the first-run wizard: the form that names the workspace. */
export const WorkspaceNewPageBase = (props: WorkspaceNewPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            descriptions={props.props.descriptions}
            currentStepId="s0"
        >
            <WorkspaceCreate />
        </FirstRunStep>
    </Page>
)
