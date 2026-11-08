import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingHandover } from "@/components/blocks/OnboardingHandover"
import { FirstRunStep } from "@/components/frames/FirstRunStep"
import type { FirstRunRail } from "@/components/frames/FirstRunStep"

/** Copy the /workspaces/new/ai page supplies. */
export interface WorkspaceHandoverPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
        /** The words of the step rail. */
        readonly rail: FirstRunRail
    }
}

/** Draws the third step of the first-run wizard: how customers are handed to the AI. */
export const WorkspaceHandoverPageBase = (props: WorkspaceHandoverPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s2"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-ai-3d.webp"
                    size="sm"
                    loading="eager"
                    assetSlot="onboarding-ai"
                    assetSha256="2d27aafdeb36d7511fd0a28db77296995acccded279058671d1a8bdc80f8859c"
                    assetPrompt="A rounded pure 3D assistant chip with a rose glow ring beside a rose shield with a white check mark, soft clay render, no characters, transparent ground"
                />
            }
        >
            <OnboardingHandover />
        </FirstRunStep>
    </Page>
)
