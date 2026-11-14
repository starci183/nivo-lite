import type { ReactElement } from "react"
import { KnowledgeSourcePage } from "@/features/pages/KnowledgeSourcePage"

export { knowledgeSourceMetadata as generateMetadata } from "@/features/pages/KnowledgeSourcePage"

/** What the page receives from Next. */
interface SourceRouteProps {
    readonly params: Promise<{ readonly workspaceId: string; readonly id: string }>
}

/** One document: its facts, its passages as agents retrieve them and its text. */
const Page = async ({ params }: SourceRouteProps): Promise<ReactElement> => {
    const { workspaceId, id } = await params
    return <KnowledgeSourcePage workspaceId={workspaceId} sourceId={id} />
}

export default Page
