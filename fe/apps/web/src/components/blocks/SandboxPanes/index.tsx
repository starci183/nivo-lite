"use client"

import { useSandboxView } from "@/hooks/sandbox"
import { SandboxPanesBase } from "./component"

/** Reads the sandbox accounts and what the open one holds, words them and builds the commands; the pure half draws the page. */
export const SandboxPanes = () => {
    const view = useSandboxView()
    return <SandboxPanesBase props={view.props} on={view.on} />
}
