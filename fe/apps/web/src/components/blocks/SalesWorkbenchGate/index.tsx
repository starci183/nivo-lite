"use client"

import type { ReactNode } from "react"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { SalesWorkbenchGateBase } from "./component"

/** What the page tells the gate. */
interface SalesWorkbenchGateProps {
    /** The Sales area that needs the workbench. */
    readonly children: ReactNode
    /** The name of the area, drawn as a skeleton while the workbench is read. */
    readonly placeholder: string
}

/** Lets a Sales area render once the Sales workbench is read; a skeleton meanwhile (the ribbon tells when the read failed). */
export const SalesWorkbenchGate = (props: SalesWorkbenchGateProps) => {
    const workbench = useSalesWorkbench()
    const state = workbench.isFailed ? "hidden" : "pending"
    return (
        <SalesWorkbenchGateBase
            state={{ content: props.children }}
            props={{ state: workbench.data === null ? state : "ready", placeholder: props.placeholder }}
        />
    )
}
