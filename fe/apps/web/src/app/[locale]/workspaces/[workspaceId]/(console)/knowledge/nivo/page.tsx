import type { ReactElement } from "react"
import { KnowledgeNivoPage } from "@/features/pages/KnowledgeNivoPage"

export { knowledgeNivoMetadata as generateMetadata } from "@/features/pages/KnowledgeNivoPage"

type PageProps = { readonly params: Promise<{ readonly workspaceId: string }> }

/** The base knowledge of NIVO per module, read-only for every member. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <KnowledgeNivoPage workspaceId={(await props.params).workspaceId} />
)

export default Page
