import { HiringApplyForm } from "@/components/blocks/HiringApplyForm"

/** Props for {@link HiringApplyPageBase}. */
export interface HiringApplyPageBaseProps {
    readonly props: {
        readonly ws: string
        readonly job: string
    }
}

/** Draws the public job page: the connected post and apply form, which draw their own shell with the company in the bar. */
export const HiringApplyPageBase = (props: HiringApplyPageBaseProps) => (
    <HiringApplyForm ws={props.props.ws} job={props.props.job} />
)
