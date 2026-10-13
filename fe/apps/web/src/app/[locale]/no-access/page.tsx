import { NoAccessPage } from "@/features/pages/NoAccessPage"

export { noAccessMetadata as generateMetadata } from "@/features/pages/NoAccessPage"

type PageProps = Parameters<typeof NoAccessPage>[0]

/** Old entry point; forwards to /workspaces. */
const Page = (props: PageProps) => <NoAccessPage searchParams={props.searchParams} />

export default Page
