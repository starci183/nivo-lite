import { InventoryWorkbenchPage as WorkbenchInventory } from "@/features/pages/InventoryWorkbenchPage"
import { LoyaltyWorkbenchPage as WorkbenchLoyalty } from "@/features/pages/LoyaltyWorkbenchPage"
import { HiringWorkbenchPage as WorkbenchHiring } from "@/features/pages/HiringWorkbenchPage"
import { BookingWorkbenchPage } from "@/features/pages/BookingWorkbenchPage"
import { ShiftsWorkbenchPage as WorkbenchShifts } from "@/features/pages/ShiftsWorkbenchPage"
import { AgentWorkbenchPage } from "@/features/pages/AgentWorkbenchPage"
import type { WorkbenchComponent } from "@/features/pages/AgentWorkbenchPage"
import { ContentWorkbenchPage as WorkbenchContent } from "@/features/pages/ContentWorkbenchPage"
import { LeadGenWorkbenchPage as WorkbenchLeadGen } from "@/features/pages/LeadGenWorkbenchPage"
import { SalesWorkbenchPage as WorkbenchSales } from "@/features/pages/SalesWorkbenchPage"
import { VideoWorkbenchPage as WorkbenchVideo } from "@/features/pages/VideoWorkbenchPage"
import { AccountingWorkbenchPage as WorkbenchAccounting } from "@/features/pages/AccountingWorkbenchPage"
import { ChatbotWorkbenchPage as WorkbenchChatbot } from "@/features/pages/ChatbotWorkbenchPage"

/** The document title of the workbench tab. */
export { agentWorkbenchMetadata as generateMetadata } from "@/features/pages/AgentWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ module: string; installation: string }>
    readonly searchParams: Promise<{ tab?: string | string[]; focus?: string | string[] }>
}

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
