import { Mascot, Page } from "@starci/grammar/common"
import { WorkspaceCreate } from "@/components/blocks/WorkspaceCreate"
import { FirstRunStep } from "@/components/composites/FirstRunStep"

/** Copy the /workspaces/new page supplies. */
export interface WorkspaceNewPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
    }
}

/** Draws the first step of the first-run wizard: the form that names the workspace. */
export const WorkspaceNewPageBase = (props: WorkspaceNewPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            currentStepId="s0"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-business.webp"
                    size="lg"
                    loading="eager"
                    assetSlot="onboarding-business"
                    assetSha256="b1bad1b482e9dca0e140479816678846fa4e4c896d4d3532e090f417ea5e11be"
                    assetPrompt="The NIVO unicorn hangs a small blank wooden shop sign on a little storefront awning, transparent ground"
                />
            }
        >
            <WorkspaceCreate />
        </FirstRunStep>
    </Page>
)
