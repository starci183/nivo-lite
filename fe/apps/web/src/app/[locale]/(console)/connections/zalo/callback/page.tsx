import { ZaloCallbackPage } from "@/features/pages/ZaloCallbackPage"

export { connectionsMetadata as generateMetadata } from "@/features/pages/ConnectionsPage"

/** What Zalo appends to the return address. */
interface PageProps {
    readonly searchParams: Promise<Readonly<Record<string, string | undefined>>>
}

/** The return address of the Zalo OA authorization. */
const Page = async (props: PageProps) => {
    const query = await props.searchParams
    return <ZaloCallbackPage code={query.code} oaId={query.oa_id} state={query.state} />
}

export default Page
