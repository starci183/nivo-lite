"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useConsoleGate } from "@/hooks/console"
import { ConsoleSessionGateBase } from "./component"

/** What the gate wraps: the console frame. */
interface ConsoleSessionGateProps {
    readonly children: ReactNode
}

/** Lets the console frame render once the signed-in person's session is read from the back end (and sends them away when it cannot be used). */
export const ConsoleSessionGate = (props: ConsoleSessionGateProps) => {
    const t = useTranslations("shell")
    const isReady = useConsoleGate()
    return <ConsoleSessionGateBase shape={{ frame: props.children }} props={{ isReady, waitingLabel: t("loading") }} />
}
