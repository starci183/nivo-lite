import { ShiftsWorkbench } from "@/components/blocks/ShiftsWorkbench"
/** Copy the server shell supplies: the route's tab and installation, the tab names and the four ribbon terms. */
export interface ShiftsWorkbenchPageBaseProps {
    readonly props: {
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
}

/** Composes the sole connected Shifts workbench from server-resolved route atoms. */
export const ShiftsWorkbenchPageBase = (props: ShiftsWorkbenchPageBaseProps) => <ShiftsWorkbench {...props.props} />
