"use client"
import { useShiftsWorkbenchView } from "@/hooks/shiftsWorkbench"
import { ShiftsWorkbenchBase } from "./component"
interface ShiftsWorkbenchProps {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: {
        readonly week: string
        readonly requests: string
        readonly setup: string
        readonly quick: string
        readonly mine: string
    }
}
/** Owns the Shifts dashboard and conditional module sessions without a node-valued tab carrier. */
export const ShiftsWorkbench = (props: ShiftsWorkbenchProps) => {
    const view = useShiftsWorkbenchView(props)
    return <ShiftsWorkbenchBase {...view} />
}
