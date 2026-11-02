"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useConsoleGate } from "@/hooks/console"
import { ConsoleSessionContext } from "@/modules/console-session"

/** The console subtree that waits for a usable session. */
interface ConsoleSessionProps {
    readonly children: ReactNode
}

/** Supplies the real session to console readers after workspace bootstrap and redirects have settled. */
export const ConsoleSession = (props: ConsoleSessionProps) => {
    const t = useTranslations("shell")
    const gate = useConsoleGate()
    return (
        <ConsoleSessionContext.Provider value={gate.session}>
            {gate.isReady ? props.children : <div role="status" aria-busy="true" aria-label={t("loading")} />}
        </ConsoleSessionContext.Provider>
    )
}
