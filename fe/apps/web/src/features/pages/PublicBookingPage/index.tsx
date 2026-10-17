import { PublicBookingPageBase } from "./component"

/** The shop slug resolved by the thin route. */
interface PublicBookingPageProps {
    readonly slug: string
}

/** The server page owner delegates rendering to its page component. */
export const PublicBookingPage = (props: PublicBookingPageProps) => (
    <PublicBookingPageBase props={{ slug: props.slug }} />
)
