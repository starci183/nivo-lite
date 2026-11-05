import { HiringInterviewReply } from "@/components/blocks/HiringInterviewReply"

/** Props for {@link HiringInterviewReplyPageBase}. */
export interface HiringInterviewReplyPageBaseProps {
    readonly props: {
        readonly token: string
    }
}

/** Draws the candidate's own interview link: the connected block draws its own shell with the business in the bar. */
export const HiringInterviewReplyPageBase = (props: HiringInterviewReplyPageBaseProps) => (
    <HiringInterviewReply token={props.props.token} />
)
