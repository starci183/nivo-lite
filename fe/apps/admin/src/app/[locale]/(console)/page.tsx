import { AdminWorkspacesPage } from "@/features/pages/AdminWorkspacesPage"

export { adminWorkspacesMetadata as generateMetadata } from "@/features/pages/AdminWorkspacesPage"

type PageProps = { readonly searchParams: Promise<{ readonly f?: string; readonly q?: string }> }

/** Admin area: every customer workspace with status, agents, connections and activity. */
const Page = (props: PageProps) => <AdminWorkspacesPage searchParams={props.searchParams} />

export default Page
