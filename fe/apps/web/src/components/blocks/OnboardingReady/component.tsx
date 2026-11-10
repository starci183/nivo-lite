import type { ListRowData } from "@starci/grammar/common"
import { CelebrationPanel } from "@/components/composites/CelebrationPanel"

/** Copy and state the connected ready screen supplies. */
export interface OnboardingReadyBaseProps {
    readonly props: {
        readonly badge: string
        readonly heading: string
        readonly description: string
        readonly nextLabel: string
        /** The first things worth doing in the new workspace, each opening its page. */
        readonly next: ReadonlyArray<ListRowData>
        readonly enterLabel: string
        readonly isLoading: boolean
    }
    readonly on: { readonly enter: () => void }
}

/** Draws the end of the first run as a celebration: the workspace is ready, the first things to do, and the way in. */
export const OnboardingReadyBase = (props: OnboardingReadyBaseProps) => (
    <CelebrationPanel
        art="onboarding-done"
        badge={props.props.badge}
        heading={props.props.heading}
        text={props.props.description}
        isLoading={props.props.isLoading}
        factsLabel=""
        facts={[]}
        nextLabel={props.props.nextLabel}
        next={props.props.next}
        primary={{ label: props.props.enterLabel, press: props.on.enter }}
    />
)
