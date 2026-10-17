import { PublicBookingContent } from "@/components/blocks/PublicBookingContent"

/** The public shop identifier passed to the interactive booking block. */
interface PublicBookingPageView {
    readonly slug: string
}

/** The server feature's pure rendering contract. */
interface PublicBookingPageBaseProps {
    readonly props: PublicBookingPageView
}

/** Passes the shop identifier to the interactive booking block. */
export const PublicBookingPageBase = (props: PublicBookingPageBaseProps) => (
    <PublicBookingContent slug={props.props.slug} />
)
