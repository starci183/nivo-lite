import { HiringApplyForm } from "@/components/blocks/HiringApplyForm"
import { HiringPublicShell } from "@/components/composites/HiringPublicShell"

/** Props for {@link HiringApplyPageBase}. */
export interface HiringApplyPageBaseProps {
    readonly props: {
        readonly ws: string
        readonly job: string
        readonly label: string
    }
}

/** Draws the public job page: the connected post and apply form in a reading column, centred in the shell. */
export const HiringApplyPageBase = (props: HiringApplyPageBaseProps) => (
    <HiringPublicShell label={props.props.label} foot={null}>
        <HiringApplyForm ws={props.props.ws} job={props.props.job} />
    </HiringPublicShell>
)
