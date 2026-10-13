import { KnowledgeSourcePage } from "@/features/pages/KnowledgeSourcePage"

export { knowledgeSourceMetadata as generateMetadata } from "@/features/pages/KnowledgeSourcePage"

/** What the page receives from Next. */
interface SourceRouteProps {
    readonly params: Promise<{ readonly id: string }>
}

/** One document: its facts, its passages as agents retrieve them and its text. */
const Page = async ({ params }: SourceRouteProps) => {
    const { id } = await params
    return <KnowledgeSourcePage sourceId={id} />
}

export default Page
