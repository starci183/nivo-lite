import type { ReactElement } from "react"
import { AuthorityPage } from "@/features/pages/AuthorityPage"

export { authorityPageMetadata as generateMetadata } from "@/features/pages/AuthorityPage"

/** What the page receives from Next. */
interface AuthorityRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
}

/** The authority page on its base address: a phone shows the list of sections. */
const Page = async ({ params }: AuthorityRouteProps): Promise<ReactElement> => {
    const { workspaceId } = await params
    return <AuthorityPage workspaceId={workspaceId} />
}

export default Page
