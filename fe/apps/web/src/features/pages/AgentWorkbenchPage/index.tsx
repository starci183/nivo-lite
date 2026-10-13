import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import WorkbenchContent from "@/features/pages/ContentWorkbenchPage"
import { InventoryWorkbenchPage as WorkbenchInventory } from "@/features/pages/InventoryWorkbenchPage"
import WorkbenchAccounting from "@/features/workbench-accounting"
import WorkbenchLoyalty from "@/features/module-loyalty"
import WorkbenchChatbot from "@/features/workbench-chatbot"
import { VideoWorkbenchPage as WorkbenchVideo } from "@/features/pages/VideoWorkbenchPage"
import WorkbenchHiring from "@/features/module-hiring"
import WorkbenchSales from "@/features/workbench-sales"
import WorkbenchBooking from "@/features/module-booking"
import WorkbenchShifts from "@/features/module-shifts"
import WorkbenchLeadGen from "@/features/module-lead-gen"
import { getInstallationById } from "@/lib/modules-core"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { AgentWorkbenchPageBase } from "./component"

/** The document title of the workbench tab. */
export const agentWorkbenchMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workbench") }
}

/** What the route hands the page: the type and the instance of the url and the deep link of the query. */
type AgentWorkbenchPageProps = {
    readonly module: string
    readonly installationId: string
    /** The `tab` of the query: the workbench area to open (the agent dashboard frame validates it). */
    readonly tab: string | null
    /** The `focus` of the query: the record a waiting row leads to. */
    readonly focus: string | null
}

/**
 * A workbench is a server component (it may be async). It receives the tab, the focus and the installation it is opened for; a
 * multi-instance type scopes its data to that installation, a single-instance type may ignore it.
 */
type WorkbenchComponent = (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>

/** The workbench of each module, by the workbench key of its catalogue entry. A module without a line shows the pending state. */
const WORKBENCHES: Readonly<Record<string, WorkbenchComponent>> = {
    chatbot: WorkbenchChatbot,
    sales: WorkbenchSales,
    loyalty: WorkbenchLoyalty,
    accounting: WorkbenchAccounting,
    content: WorkbenchContent,
    inventory: WorkbenchInventory,
    booking: WorkbenchBooking,
    video: WorkbenchVideo,
    hiring: WorkbenchHiring,
    shifts: WorkbenchShifts,
    lead_gen: WorkbenchLeadGen,
}

/** The workbench slot of one instance: the working screen of the module scoped to the instance, or the pending state. */
export const AgentWorkbenchPage = async (props: AgentWorkbenchPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const installation = await getInstallationById(props.installationId)
    if (!installation || installation.moduleKey !== props.module) notFound()
    const key = MODULE_REGISTRY[props.module].workbench
    const Workbench = key === null ? undefined : WORKBENCHES[key]
    if (Workbench !== undefined) return <Workbench tab={props.tab} focus={props.focus} installation={installation} />
    const t = await getTranslations("modulesCore")
    return (
        <AgentWorkbenchPageBase
            props={{
                title: t("workbenchTitle"),
                body: t("workbenchBody"),
                setupLabel: t("workbenchSetup"),
                setupHref: agentHref(props.module, installation.id),
            }}
        />
    )
}
