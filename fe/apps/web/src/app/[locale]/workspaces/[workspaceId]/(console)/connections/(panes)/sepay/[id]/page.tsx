import type { ReactElement } from "react"
import { SepayConnectionPage } from "@/features/pages/SepayConnectionPage"

/** The document title of the SePay connection page. */
export { sepayConnectionMetadata as generateMetadata } from "@/features/pages/SepayConnectionPage"

type PageProps = {
    readonly params: Promise<{ workspaceId: string; id: string }>
}

/** One SePay connection: its setup steps in back end order, its health and its live webhook events, on one page. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, id } = await props.params
    return <SepayConnectionPage workspaceId={workspaceId} connectionId={id} />
}

export default Page
