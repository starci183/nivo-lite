import { KnowledgeRedirectPage } from "@/features/pages/KnowledgeRedirectPage"

export { knowledgeRedirectMetadata as generateMetadata } from "@/features/pages/KnowledgeRedirectPage"

/** What the old address may carry: the agent filter and the idea the add drawer opens on. */
interface KnowledgeSearch {
    readonly module?: string
    readonly add?: string
}

/** What the page receives from Next. */
interface KnowledgeRouteProps {
    readonly searchParams: Promise<KnowledgeSearch>
}

/** Moved: the documents are the sources tab of the Second Brain, so the old address forwards there. */
const Page = async ({ searchParams }: KnowledgeRouteProps) => {
    const { module, add } = await searchParams
    return <KnowledgeRedirectPage module={module} add={add} />
}

export default Page
