import { Mascot, Page, Stepper } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspaceCreate } from "@/components/blocks/WorkspaceCreate"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import { AUTH_ROUTES } from "@/modules/routes"
import {
    STEP_ART_CLASS_NAME,
    STEP_BODY_CLASS_NAME,
    STEP_CLASS_NAME,
    STEP_FORM_CLASS_NAME,
    STEP_TRACK_CLASS_NAME,
} from "./classNames"

/** Copy and values the new-workspace page supplies. */
export interface WorkspaceNewPageBaseProps {
    readonly props: {
        readonly title: string
        /** The accessible name of the first-run steps and their labels, in order; this page is the first step. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<string>
    }
}

/** Draws the new-workspace screen, the first step of the first-run wizard: the step track, the form that names the workspace and the step's small mascot beside it. */
export const WorkspaceNewPageBase = (props: WorkspaceNewPageBaseProps) => (
    <WorkspacesFrame
        homeHref={AUTH_ROUTES.workspaces}
        mainLabel={props.props.title}
        logo={<BrandLogo variant="full" height={40} />}
        localeSwitch={<LocaleSwitch />}
        account={<WorkspacesAccount />}
    >
        <Page measure="product">
            <div className={STEP_CLASS_NAME}>
                <div className={STEP_TRACK_CLASS_NAME}>
                    <Stepper
                        label={props.props.stepsLabel}
                        currentStepId="s0"
                        steps={props.props.steps.map((label, index) => ({ id: `s${index}`, label }))}
                    />
                </div>
                <div className={STEP_BODY_CLASS_NAME}>
                    <div className={STEP_FORM_CLASS_NAME}>
                        <WorkspaceCreate />
                    </div>
                    <div className={STEP_ART_CLASS_NAME}>
                        <Mascot
                            src="/images/entry/onboarding-business.webp"
                            size="lg"
                            assetSlot="onboarding-business"
                            assetSha256="b1bad1b482e9dca0e140479816678846fa4e4c896d4d3532e090f417ea5e11be"
                            assetPrompt="The NIVO unicorn hangs a small blank wooden shop sign on a little storefront awning, transparent ground"
                        />
                    </div>
                </div>
            </div>
        </Page>
    </WorkspacesFrame>
)
