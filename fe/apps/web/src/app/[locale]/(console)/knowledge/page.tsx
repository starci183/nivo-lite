import { KnowledgePage } from "@/features/pages/KnowledgePage"

export { knowledgeMetadata as generateMetadata } from "@/features/pages/KnowledgePage"

/** What the address may ask for: the agent filter and the idea the add drawer opens on. */
interface KnowledgeSearch {
    readonly module?: string
    readonly add?: string
}

/** What the page receives from Next. */
interface KnowledgeRouteProps {
    readonly searchParams: Promise<KnowledgeSearch>
}

/** The documents of the workspace: everyone reads, owners and managers write. */
const Page = async ({ searchParams }: KnowledgeRouteProps) => {
    const { module, add } = await searchParams
    return <KnowledgePage module={module} add={add} />
}

export default Page
