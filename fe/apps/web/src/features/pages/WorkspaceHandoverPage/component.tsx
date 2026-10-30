import { Mascot, Page } from "@starci/grammar/common"
import { OnboardingHandover } from "@/components/blocks/OnboardingHandover"
import { FirstRunStep } from "@/components/composites/FirstRunStep"

/** Copy the /workspaces/new/ai page supplies. */
export interface WorkspaceHandoverPageBaseProps {
    readonly props: {
        /** The accessible name of the first-run steps and their labels, in order. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
    }
}

/** Draws the third step of the first-run wizard: how customers are handed to the AI. */
export const WorkspaceHandoverPageBase = (props: WorkspaceHandoverPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            currentStepId="s2"
            artwork={
                <Mascot
                    src="/images/entry/onboarding-ai.webp"
                    size="lg"
                    loading="eager"
                    assetSlot="onboarding-ai"
                    assetSha256="80f259a7ea38a66a5dba4de2c03a38282e553f49004b0b1d41b6b2b409382e38"
                    assetPrompt="The NIVO unicorn sits beside a small friendly white robot helper, both looking at a clipboard with red check marks, transparent ground"
                />
            }
        >
            <OnboardingHandover />
        </FirstRunStep>
    </Page>
)
