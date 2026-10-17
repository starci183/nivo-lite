import type { Metadata } from "next"
import { PublicBookingPage } from "@/features/pages/PublicBookingPage"
import messages from "@/modules/i18n/messages/en.json"

/** Generic booking title; shop-specific titles are set after the client read. */
export const metadata: Metadata = { title: messages.workbenchBooking.publicTitle, robots: { index: false } }

/** Rendered per request: the public booking page reads the shop slug of the URL. */
export const dynamic = "force-dynamic"

/** The public shop identifier carried by the route. */
interface PublicBookingParams {
    readonly slug: string
}

/** Next supplies route parameters asynchronously. */
interface PageProps {
    readonly params: Promise<PublicBookingParams>
}

/** Public booking page of one shop. */
const Page = async (props: PageProps) => <PublicBookingPage slug={(await props.params).slug} />

export default Page
