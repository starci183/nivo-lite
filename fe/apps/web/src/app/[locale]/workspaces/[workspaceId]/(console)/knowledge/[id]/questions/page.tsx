import type { ReactElement } from "react"
import { KnowledgeQuestionsPage } from "@/features/pages/KnowledgeQuestionsPage"

export { knowledgeQuestionsMetadata as generateMetadata } from "@/features/pages/KnowledgeQuestionsPage"

/** What the page receives from Next. */
interface QuestionsRouteProps {
    readonly params: Promise<{ readonly workspaceId: string; readonly id: string }>
}

/** The questions the critic raised about one document, answered on a page of their own. */
const Page = async ({ params }: QuestionsRouteProps): Promise<ReactElement> => {
    const { workspaceId, id } = await params
    return <KnowledgeQuestionsPage workspaceId={workspaceId} sourceId={id} />
}

export default Page
