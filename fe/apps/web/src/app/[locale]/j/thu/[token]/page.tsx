import { HiringOfferReplyPage } from "@/features/pages/HiringOfferReplyPage"

export { hiringOfferReplyMetadata as generateMetadata } from "@/features/pages/HiringOfferReplyPage"

type PageProps = Parameters<typeof HiringOfferReplyPage>[0]

/** The candidate's own offer link: accept or decline the offer. */
const Page = (props: PageProps) => <HiringOfferReplyPage params={props.params} />

export default Page
