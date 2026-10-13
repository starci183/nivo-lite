import { ConnectionsPage } from "@/features/pages/ConnectionsPage"

/** The document title of the Connections page. */
export { connectionsMetadata as generateMetadata } from "@/features/pages/ConnectionsPage"

type PageProps = { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Connections: the workspace's own Telegram bots, bank feeds, Zalo OA, Facebook, data sources and tools. Owner and manager only. */
const Page = (props: PageProps) => <ConnectionsPage searchParams={props.searchParams} />

export default Page
