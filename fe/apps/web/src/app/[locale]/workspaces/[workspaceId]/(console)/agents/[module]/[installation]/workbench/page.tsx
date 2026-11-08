import type { ReactElement } from "react"
import { HiringWorkbenchPage as WorkbenchHiring } from "@/features/pages/HiringWorkbenchPage"
import { BookingWorkbenchPage } from "@/features/pages/BookingWorkbenchPage"
import { AgentWorkbenchPage, type WorkbenchComponent } from "@/features/pages/AgentWorkbenchPage"
import { VideoWorkbenchPage as WorkbenchVideo } from "@/features/pages/VideoWorkbenchPage"

/** The document title of the workbench tab. */
export { agentWorkbenchMetadata as generateMetadata } from "@/features/pages/AgentWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ workspaceId: string; module: string; installation: string }>
    readonly searchParams: Promise<{
        tab?: string | string[]
        focus?: string | string[]
        conversation?: string | string[]
    }>
}

/** The workbench of each module, by the workbench key of its catalogue entry. A module without a line shows the pending state. */
const WORKBENCHES: Readonly<Record<string, WorkbenchComponent>> = {
    booking: BookingWorkbenchPage,
    video: WorkbenchVideo,
    hiring: WorkbenchHiring,
}

const first = (value: string | string[] | undefined): string | null => {
    const picked = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
    return picked === "" ? null : picked
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
            focus={first(query.focus)}
            conversation={first(query.conversation)}
            workbenches={WORKBENCHES}
        />
    )
}

export default Page
