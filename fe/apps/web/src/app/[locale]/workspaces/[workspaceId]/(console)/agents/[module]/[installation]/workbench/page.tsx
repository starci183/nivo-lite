import type { ReactElement } from "react"
import { AgentWorkbenchPage } from "@/features/pages/AgentWorkbenchPage"

/** The document title of the workbench tab. */
export { agentWorkbenchMetadata as generateMetadata } from "@/features/pages/AgentWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ workspaceId: string; module: string; installation: string }>
    readonly searchParams: Promise<{
        tab?: string | string[]
    }>
}

const first = (value: string | string[] | undefined): string | null => {
    const raw = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
    return raw === "" ? null : raw
}

/** The workbench slot of one agent instance; the tab and focus of the query are the deep link contract of the agent dashboard frame. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const [{ workspaceId, module, installation }, query] = await Promise.all([props.params, props.searchParams])
    return (
        <AgentWorkbenchPage
            workspaceId={workspaceId}
            module={module}
            installationId={installation}
            tab={first(query.tab)}
        />
    )
}

export default Page
