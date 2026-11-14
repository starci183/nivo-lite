import type { ReactElement } from "react"
import { ConnectionMovedPage } from "@/features/pages/ConnectionMovedPage"

/** The document title of the old address. */
export { connectionMovedMetadata as generateMetadata } from "@/features/pages/ConnectionMovedPage"

type PageProps = {
    readonly params: Promise<{ readonly workspaceId: string; readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The old per-provider address of an account: it forwards to the account's page on the one provider template. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, id } = await props.params
    const query = await props.searchParams
    const raw = query.view ?? query.tab
    return (
        <ConnectionMovedPage workspaceId={workspaceId} connectionId={id} view={typeof raw === "string" ? raw : undefined} />
    )
}

export default Page
