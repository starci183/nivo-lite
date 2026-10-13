"use client"

import type { ReactNode } from "react"
import { useConsoleGate } from "@/hooks/console"

/** What the gate wraps: the console frame. */
interface ConsoleSessionGateProps {
    readonly children: ReactNode
}

/** Lets the console frame render once the signed-in person's session is read from the back end (and sends them away when it cannot be used). */
export const ConsoleSessionGate = (props: ConsoleSessionGateProps) => {
    const ready = useConsoleGate()
    return ready ? props.children : null
}
