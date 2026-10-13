import { HiringInterviewReplyPage } from "@/features/pages/HiringInterviewReplyPage"

export { hiringInterviewReplyMetadata as generateMetadata } from "@/features/pages/HiringInterviewReplyPage"

type PageProps = Parameters<typeof HiringInterviewReplyPage>[0]

/** The candidate's own interview link: choose one of the proposed times. */
const Page = (props: PageProps) => <HiringInterviewReplyPage params={props.params} />

export default Page
