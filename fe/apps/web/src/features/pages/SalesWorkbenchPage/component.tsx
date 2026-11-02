import { SalesWorkbench } from "@/components/blocks/SalesWorkbench"

/** The six Sales areas, by tab id. */
type SalesTab = "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity" | "conversation"

/** The resolved route state and the tab names of the Sales workbench. */
interface SalesWorkbenchPageBaseProps {
    readonly props: {
        /** The Sales agent instance the workbench opens for. */
        readonly installationId: string | null
        /** The selected tab. */
        readonly tab: string
        /** The decision to highlight, if any. */
        readonly focus: string | null
        /** The conversation of a customer to draw beside the desk (`?conversation=`). */
        readonly conversation: string | null
        readonly tabs: Readonly<Record<SalesTab, string>>
    }
}

/** The server page composes its Sales world from the same resolved route atoms. */
export const SalesWorkbenchPageBase = (props: SalesWorkbenchPageBaseProps) => <SalesWorkbench {...props.props} />
