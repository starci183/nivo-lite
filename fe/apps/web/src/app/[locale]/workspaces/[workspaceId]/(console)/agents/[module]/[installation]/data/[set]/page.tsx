import type { ReactElement } from "react"
import { AgentDataPage } from "@/features/pages/AgentDataPage"

/** The document title of a data page. */
export { agentDataMetadata as generateMetadata } from "@/features/pages/AgentDataPage"

type PageProps = {
    readonly params: Promise<{ workspaceId: string; module: string; installation: string; set: string }>
}

/** The data page of one set of one agent instance: a table of the provider's records with paging, and the detail of the chosen row. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation, set } = await props.params
    return <AgentDataPage workspaceId={workspaceId} module={module} installationId={installation} set={set} />
}

export default Page
