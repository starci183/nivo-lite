"use client"

import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useConsoleGate } from "@/hooks/console"
import { ConsoleSessionContext } from "@/modules/console-session"

/** The console subtree that waits for a usable session. */
interface ConsoleSessionProps {
    readonly children: ReactNode
}

/** What the session gate draws: the label announced while it waits, and the subtree it lets through once ready. */
interface ConsoleSessionGateBaseProps {
    readonly isReady: boolean
    readonly loadingLabel: string
    readonly content: ReactNode
}

/** Draws the console subtree once the session is usable, and an announced busy region until then. */
const ConsoleSessionGateBase = (props: ConsoleSessionGateBaseProps): ReactNode =>
    props.isReady ? props.content : <div role="status" aria-busy="true" aria-label={props.loadingLabel} />

/** Supplies the real session to console readers after workspace bootstrap and redirects have settled; a workspace the person is not a member of answers not found before anything of it renders. */
export const ConsoleSession = (props: ConsoleSessionProps) => {
    const t = useTranslations("shell")
    const gate = useConsoleGate()
    if (gate.isMissing) notFound()
    return (
        <ConsoleSessionContext.Provider value={gate.session}>
            <ConsoleSessionGateBase isReady={gate.isReady} loadingLabel={t("loading")} content={props.children} />
        </ConsoleSessionContext.Provider>
    )
}
