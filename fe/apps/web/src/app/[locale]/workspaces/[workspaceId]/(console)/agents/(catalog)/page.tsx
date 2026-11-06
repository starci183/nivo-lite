import type { ReactElement } from "react"
import { AgentsCatalogPage } from "@/features/pages/AgentsCatalogPage"

/** The document title of the catalogue. */
export { agentsCatalogMetadata as generateMetadata } from "@/features/pages/AgentsCatalogPage"

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** The agent catalogue slot. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <AgentsCatalogPage workspaceId={(await props.params).workspaceId} />
)

export default Page
