"use client"

import { useHiringWorkbenchView } from "@/hooks/hiringWorkbench"
import { HiringWorkbenchBase } from "./component"

/** The route identity and server-resolved words of one hiring workbench. */
type HiringWorkbenchProps = Parameters<typeof useHiringWorkbenchView>[0]

/** Owns the hiring board, active forms and candidate overlay as one connected module. */
export const HiringWorkbench = (props: HiringWorkbenchProps) => {
    const view = useHiringWorkbenchView(props)
    return <HiringWorkbenchBase {...view} />
}
