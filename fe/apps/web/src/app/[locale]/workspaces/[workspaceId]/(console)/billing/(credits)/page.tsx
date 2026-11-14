import type { ReactElement } from "react"
import { CreditsPage } from "@/features/pages/CreditsPage"

export { creditsMetadata as generateMetadata } from "@/features/pages/CreditsPage"

/** What the page receives from Next. */
interface CreditsRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
}

/** This month's credits, top-up packs, upgrade and payment history. */
const Page = async ({ params }: CreditsRouteProps): Promise<ReactElement> => {
    const { workspaceId } = await params
    return <CreditsPage workspaceId={workspaceId} />
}

export default Page
