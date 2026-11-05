import { HiringOfferReply } from "@/components/blocks/HiringOfferReply"

/** Props for {@link HiringOfferReplyPageBase}. */
export interface HiringOfferReplyPageBaseProps {
    readonly props: {
        readonly token: string
    }
}

/** Draws the candidate's own offer link: the connected block draws its own shell with the business in the bar. */
export const HiringOfferReplyPageBase = (props: HiringOfferReplyPageBaseProps) => (
    <HiringOfferReply token={props.props.token} />
)
