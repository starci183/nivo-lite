import { HiringOfferReply } from "@/components/blocks/HiringOfferReply"
import { HiringPublicShell } from "@/components/composites/HiringPublicShell"

/** Props for {@link HiringOfferReplyPageBase}. */
export interface HiringOfferReplyPageBaseProps {
    readonly props: {
        readonly token: string
        readonly label: string
        readonly foot: string
    }
}

/** Draws the candidate's offer link: the connected letter in a reading column, with the foot line. */
export const HiringOfferReplyPageBase = (props: HiringOfferReplyPageBaseProps) => (
    <HiringPublicShell label={props.props.label} foot={props.props.foot}>
        <HiringOfferReply token={props.props.token} />
    </HiringPublicShell>
)
