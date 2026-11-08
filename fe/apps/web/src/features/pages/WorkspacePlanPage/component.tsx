import { Page } from "@starci/grammar/common"
import { OnboardingPlan } from "@/components/blocks/OnboardingPlan"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import type { FirstRunRail } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new/plan page supplies. */
export interface WorkspacePlanPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** The words of the step rail. */
        readonly rail: FirstRunRail
        /** Where the Enterprise plan sends the owner to talk to NIVO. */
        readonly contactHref: string
    }
}

/** Draws the plan step of the first-run wizard as a pricing page: the plans side by side, Enterprise to ask about, the free plan to start on. */
export const WorkspacePlanPageBase = (props: WorkspacePlanPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s3"
            layout="wide"
            artwork={null}
        >
            <OnboardingPlan contactHref={props.props.contactHref} />
        </FirstRunStep>
    </Page>
)
