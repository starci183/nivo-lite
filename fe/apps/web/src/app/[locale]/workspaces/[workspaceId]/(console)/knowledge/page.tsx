import type { ReactElement } from "react"
import { KnowledgeRedirectPage } from "@/features/pages/KnowledgeRedirectPage"

export { knowledgeRedirectMetadata as generateMetadata } from "@/features/pages/KnowledgeRedirectPage"

/** What the old address may carry: the agent filter and the idea the add drawer opens on. */
interface KnowledgeSearch {
    readonly module?: string
    readonly add?: string
}

/** What the page receives from Next. */
interface KnowledgeRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
    readonly searchParams: Promise<KnowledgeSearch>
}

/** Moved: the documents are the sources tab of the Second Brain, so the old address forwards there. */
const Page = async ({ params, searchParams }: KnowledgeRouteProps): Promise<ReactElement> => {
    const [{ workspaceId }, { module, add }] = await Promise.all([params, searchParams])
    return <KnowledgeRedirectPage workspaceId={workspaceId} module={module} add={add} />
}

export default Page
