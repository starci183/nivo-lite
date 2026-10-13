import { InvitePage } from "@/features/pages/InvitePage"

export { inviteMetadata as generateMetadata } from "@/features/pages/InvitePage"

type PageProps = Parameters<typeof InvitePage>[0]

/** Public invitation page. */
const Page = (props: PageProps) => <InvitePage params={props.params} />

export default Page
