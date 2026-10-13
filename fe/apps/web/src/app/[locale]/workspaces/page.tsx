import { WorkspacesPage } from "@/features/pages/WorkspacesPage"

export { workspacesMetadata as generateMetadata } from "@/features/pages/WorkspacesPage"

type PageProps = { readonly searchParams: Promise<{ readonly reason?: string }> }

/** Home after sign-in: my workspaces, and the way to create one or join by link. */
const Page = (props: PageProps) => <WorkspacesPage searchParams={props.searchParams} />

export default Page
