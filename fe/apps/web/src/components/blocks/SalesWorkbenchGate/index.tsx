"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { SalesWorkbenchGateBase } from "./component"

/** What the page tells the gate. */
interface SalesWorkbenchGateProps {
    /** The Sales area that needs the workbench. */
    readonly children: ReactNode
    /** The name of the area, drawn as a skeleton while the workbench is read. */
    readonly placeholder: string
}

/** Lets a Sales area render once the Sales workbench is read; a skeleton meanwhile and a retry when the read failed. */
export const SalesWorkbenchGate = (props: SalesWorkbenchGateProps) => {
    const t = useTranslations("workbenchSales")
    const slotLabels = useSlotLabels()
    const workbench = useSalesWorkbench()
    return (
        <SalesWorkbenchGateBase
            shape={{ content: props.children }}
            props={{
                slot: mapSlot(workbench.slot, () => true),
                slotLabels: slotLabels(t("loadFailedTitle")),
                placeholder: props.placeholder,
            }}
            on={{ retry: workbench.retry }}
        />
    )
}
