import { PublicBookingPage } from "@/features/pages/PublicBookingPage"

export { publicBookingMetadata as generateMetadata } from "@/features/pages/PublicBookingPage"

export const dynamic = "force-dynamic"

type PageProps = Parameters<typeof PublicBookingPage>[0]

/** Public booking page of one shop. */
const Page = (props: PageProps) => <PublicBookingPage params={props.params} />

export default Page
