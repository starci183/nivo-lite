import type { ReactElement } from "react"
import { WorkspaceHomeRedirectPage } from "@/features/pages/WorkspaceHomeRedirectPage"

export { workspaceHomeRedirectMetadata as generateMetadata } from "@/features/pages/WorkspaceHomeRedirectPage"

type PageProps = { readonly params: Promise<{ readonly workspaceId: string }> }

/** The front address of a workspace: it only forwards to the dashboard. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <WorkspaceHomeRedirectPage workspaceId={(await props.params).workspaceId} />
)

export default Page
