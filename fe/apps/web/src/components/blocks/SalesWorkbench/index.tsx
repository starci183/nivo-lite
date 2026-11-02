"use client"

import { useSalesWorkbenchView } from "@/hooks/salesworkbench"
import { SalesWorkbenchBase } from "./component"

/** The existing Sales instance, route focus, optional customer conversation and resolved labels. */
type SalesWorkbenchProps = Parameters<typeof useSalesWorkbenchView>[0]

/** Owns the Sales world and renders only its own pure workbench drawing. */
export const SalesWorkbench = (props: SalesWorkbenchProps) => {
    const view = useSalesWorkbenchView(props)
    return <SalesWorkbenchBase {...view} />
}
