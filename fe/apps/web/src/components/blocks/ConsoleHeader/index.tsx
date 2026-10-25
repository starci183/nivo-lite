"use client"

import { useConsoleHeader } from "@/hooks/console"
import { ConsoleHeaderBase } from "./component"

/** The connected console top bar: workspace, search, language, appearance, notifications and the account menu. */
export const ConsoleHeader = () => {
    const header = useConsoleHeader()
    return <ConsoleHeaderBase props={header.props} on={header.on} />
}
