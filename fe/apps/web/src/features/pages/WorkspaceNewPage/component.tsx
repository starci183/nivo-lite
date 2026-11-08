import { Mascot, Page } from "@starci/grammar/common"
import { WorkspaceCreate } from "@/components/blocks/WorkspaceCreate"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import type { FirstRunRail } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new page supplies. */
export interface WorkspaceNewPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** The words of the step rail. */
        readonly rail: FirstRunRail
    }
}

/** Draws the first step of the first-run wizard: the form that names the workspace. */
export const WorkspaceNewPageBase = (props: WorkspaceNewPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s0"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-business-3d.webp"
                    size="sm"
                    loading="eager"
                    assetSlot="onboarding-business"
                    assetSha256="b7241cf5e2a2c49d2f171021ee051007e6fdd1091ce36b71ef349910ddde2050"
                    assetPrompt="A small pure 3D storefront with a rose-and-white striped awning, a door, a window and a blank rounded sign board, soft clay render, no characters, transparent ground"
                />
            }
        >
            <WorkspaceCreate />
        </FirstRunStep>
    </Page>
)
