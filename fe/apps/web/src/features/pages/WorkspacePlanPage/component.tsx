import { Mascot, Page } from "@starci/grammar/common"
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

/** Draws the plan step of the first-run wizard: a paid plan to buy, Enterprise to ask about, or the free plan to start on. */
export const WorkspacePlanPageBase = (props: WorkspacePlanPageBaseProps) => (
    <Page measure="product">
        <FirstRunStep
            stepsLabel={props.props.stepsLabel}
            steps={props.props.steps}
            rail={props.props.rail}
            currentStepId="s3"
            artwork={
                <Mascot
                    src="/images/promo/payment-waiting-3d.webp"
                    size="sm"
                    loading="eager"
                    assetSlot="onboarding-plan"
                    assetSha256="9ef2397dc38f5b4b295a13f5b1fab7b7cc8ec08138b788f0afc28cb02c915992"
                    assetPrompt="A pure 3D phone-sized card with a blank QR-like pattern beside a rose alarm clock, soft clay render, no characters, transparent ground"
                />
            }
        >
            <OnboardingPlan contactHref={props.props.contactHref} />
        </FirstRunStep>
    </Page>
)
