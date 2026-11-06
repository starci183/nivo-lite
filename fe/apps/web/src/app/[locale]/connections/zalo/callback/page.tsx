import type { ReactElement } from "react"
import { ZaloForwardPage } from "@/features/pages/ZaloForwardPage"

export { zaloForwardMetadata as generateMetadata } from "@/features/pages/ZaloForwardPage"

/** What Zalo appends to the return address. */
interface PageProps {
    readonly searchParams: Promise<Readonly<Record<string, string | undefined>>>
}

/** The fixed return address of the Zalo OA authorization (the back end registers it with Zalo): it forwards into the workspace that started it. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const query = await props.searchParams
    return <ZaloForwardPage code={query.code} oaId={query.oa_id} state={query.state} />
}

export default Page
