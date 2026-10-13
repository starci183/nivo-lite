import { AdminWorkspacePage } from "@/features/pages/AdminWorkspacePage"

export { adminWorkspaceMetadata as generateMetadata } from "@/features/pages/AdminWorkspacePage"

type PageProps = { readonly params: Promise<{ readonly id: string }> }

/** Admin area: the read-only overview of one workspace and the confirmed support actions. */
const Page = (props: PageProps) => <AdminWorkspacePage params={props.params} />

export default Page
