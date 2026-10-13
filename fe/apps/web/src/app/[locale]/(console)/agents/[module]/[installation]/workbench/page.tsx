import type { WorkbenchComponent } from "@/features/pages/AgentWorkbenchPage"
import { AgentWorkbenchPage } from "@/features/pages/AgentWorkbenchPage"
import WorkbenchContent from "@/features/pages/ContentWorkbenchPage"
import WorkbenchInventory from "@/features/module-inventory"
import WorkbenchAccounting from "@/features/workbench-accounting"
import WorkbenchLoyalty from "@/features/module-loyalty"
import WorkbenchChatbot from "@/features/workbench-chatbot"
import { VideoWorkbenchPage as WorkbenchVideo } from "@/features/pages/VideoWorkbenchPage"
import WorkbenchHiring from "@/features/module-hiring"
import WorkbenchSales from "@/features/workbench-sales"
import { BookingWorkbenchPage } from "@/features/pages/BookingWorkbenchPage"
import WorkbenchShifts from "@/features/module-shifts"
import WorkbenchLeadGen from "@/features/module-lead-gen"

/** The document title of the workbench tab. */
export { agentWorkbenchMetadata as generateMetadata } from "@/features/pages/AgentWorkbenchPage"

/** The workbench of each module, by the workbench key of its catalogue entry. A module without a line shows the pending state. */
const WORKBENCHES: Readonly<Record<string, WorkbenchComponent>> = {
    chatbot: WorkbenchChatbot,
    sales: WorkbenchSales,
    loyalty: WorkbenchLoyalty,
    accounting: WorkbenchAccounting,
    content: WorkbenchContent,
    inventory: WorkbenchInventory,
    booking: BookingWorkbenchPage,
    video: WorkbenchVideo,
    hiring: WorkbenchHiring,
    shifts: WorkbenchShifts,
    lead_gen: WorkbenchLeadGen,
}

type PageProps = {
    readonly params: Promise<{ module: string; installation: string }>
    readonly searchParams: Promise<{ tab?: string | string[]; focus?: string | string[] }>
}

const first = (value: string | string[] | undefined): string | null =>
    (Array.isArray(value) ? (value[0] ?? null) : (value ?? null)) || null

/** The workbench slot of one agent instance; the tab and focus of the query are the deep link contract of the agent dashboard frame. */
const Page = async (props: PageProps) => {
    const [{ module, installation }, query] = await Promise.all([props.params, props.searchParams])
    return (
        <AgentWorkbenchPage
            module={module}
            installationId={installation}
            tab={first(query.tab)}
            focus={first(query.focus)}
            workbenches={WORKBENCHES}
        />
    )
}

export default Page
