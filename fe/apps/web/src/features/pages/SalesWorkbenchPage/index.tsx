import { salesTabOf } from "@/hooks/sales"
import { SalesWorkbenchPageBase } from "./component"

/** What the route passes. */
interface SalesWorkbenchPageProps {
    /** The selected Sales tab. */
    readonly tab?: string | null
    /** The pending decision to highlight. */
    readonly focus?: string | null
}

/** The server shell: resolves the tab from the route and hands the connected workbench its state. */
export const SalesWorkbenchPage = (props: SalesWorkbenchPageProps) => {
    const focus = props.focus ?? null
    const tab = salesTabOf(props.tab) ?? (focus ? "decisions" : "attention")
    return <SalesWorkbenchPageBase props={{ tab, focus }} />
}
