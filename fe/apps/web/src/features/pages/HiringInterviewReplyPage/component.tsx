import { HiringInterviewReply } from "@/components/blocks/HiringInterviewReply"
import { HiringPublicShell } from "@/components/composites/HiringPublicShell"

/** Props for {@link HiringInterviewReplyPageBase}. */
export interface HiringInterviewReplyPageBaseProps {
    readonly props: {
        readonly token: string
        readonly label: string
        readonly foot: string
    }
}

/** Draws the candidate's interview link: the connected invitation in a reading column, with the foot line. */
export const HiringInterviewReplyPageBase = (props: HiringInterviewReplyPageBaseProps) => (
    <HiringPublicShell label={props.props.label} foot={props.props.foot}>
        <HiringInterviewReply token={props.props.token} />
    </HiringPublicShell>
)
