import { ShiftsWorkbench } from "@/components/blocks/ShiftsWorkbench"

/** What the agent workbench route hands the slot. */
interface ShiftsWorkbenchPageProps {
    /** `?tab=` from the route (week, requests, setup, quick, mine); anything else opens the first tab. */
    readonly tab?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Shifts workbench slot: a thin server shell that mounts the connected client block. */
export const ShiftsWorkbenchPage = (props: ShiftsWorkbenchPageProps) => (
    <ShiftsWorkbench initialTab={props.tab ?? null} installationId={props.installationId ?? null} />
)
