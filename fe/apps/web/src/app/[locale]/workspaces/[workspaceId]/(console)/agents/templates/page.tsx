import type { Metadata } from "next"
import type { ReactElement } from "react"
import { AgentTemplatesPage, agentTemplatesMetadataOf } from "@/features/pages/AgentTemplatesPage"

/** The document title of this page. */
export const generateMetadata: () => Promise<Metadata> = agentTemplatesMetadataOf("templates")

type PageProps = { readonly params: Promise<{ workspaceId: string }> }

/** The templates slot. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <AgentTemplatesPage view="templates" workspaceId={(await props.params).workspaceId} />
)

export default Page
