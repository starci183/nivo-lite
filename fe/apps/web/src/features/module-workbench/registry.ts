import type { ReactNode } from "react"
import WorkbenchContent from "@/features/pages/ContentWorkbenchPage"
import WorkbenchInventory from "@/features/module-inventory"
import WorkbenchAccounting from "@/features/workbench-accounting"
import WorkbenchLoyalty from "@/features/module-loyalty"
import WorkbenchChatbot from "@/features/workbench-chatbot"
import { VideoWorkbenchPage as WorkbenchVideo } from "@/features/pages/VideoWorkbenchPage"
import WorkbenchHiring from "@/features/module-hiring"
import WorkbenchSales from "@/features/workbench-sales"
import WorkbenchBooking from "@/features/module-booking"
import WorkbenchShifts from "@/features/module-shifts"
import WorkbenchLeadGen from "@/features/module-lead-gen"

/**
 * A workbench is a server component (it may be async). It receives `tab`, `focus` and `installation` (the instance it is opened for); a
 * multi-instance type (chatbot, booking, lead_gen) scopes its data to that installation, a single-instance type may ignore it.
 */
export type WorkbenchComponent = (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>

/**
 * Workbench registry: "workbench" key of resources/modules/<key>/module.json -> the module's own working screen.
 * A new module adds ONE line here (and sets "workbench" in its module.json). A module without a line shows the "Đang hoàn thiện" state.
 */
export const WORKBENCHES: Readonly<Record<string, WorkbenchComponent>> = {
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
