import type { Metadata } from "next"
import type { ReactElement } from "react"
import { AgentTemplatesPage, agentTemplatesMetadataOf } from "@/features/pages/AgentTemplatesPage"

/** The document title of the packaging page. */
export const generateMetadata: () => Promise<Metadata> = agentTemplatesMetadataOf("package")

type PageProps = { readonly params: Promise<{ workspaceId: string; installation: string }> }

/** The packaging slot of one installed agent. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, installation } = await props.params
    return <AgentTemplatesPage view="package" installationId={installation} workspaceId={workspaceId} />
}

export default Page
