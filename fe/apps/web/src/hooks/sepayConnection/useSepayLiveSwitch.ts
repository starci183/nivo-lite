"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { navigation } from "@/modules/i18n"
import { sepaySetupDone } from "./sepayConnection.shared"
import { useSepayCommands } from "./useSepayCommands"
import { useSepayConnection } from "./useSepayConnection"

/** The search param that says the question about real money is open, so the picker and the notice that ask it agree. */
const PARAM = "live"

/** What the live switch of a SePay connection reads and does. */
interface SepayLiveSwitch {
    /** The test ran well (a transaction came through) and the owner may switch: the notice offers the switch. */
    readonly isOffered: boolean
    readonly isAsking: boolean
    readonly isPending: boolean
    readonly accountMasked: string
    readonly ask: () => void
    readonly dismiss: () => void
    /** Switches to real money once the owner answered the question. */
    readonly confirm: () => void
}

/**
 * Switching a connection from test to live books real money, so it asks first. The question lives in the address (`?live=ask`) so the
 * environment step and the notice that offers the switch open the same one dialog.
 */
export const useSepayLiveSwitch = (connectionId: string): SepayLiveSwitch => {
    const pathname = navigation.usePathname()
    const params = useSearchParams()
    const connection = useSepayConnection(connectionId)
    const commands = useSepayCommands(connectionId)
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const view = "items" in connection.slot ? connection.slot.items : undefined
    const push = (isOpen: boolean): void => {
        const next = new URLSearchParams(params.toString())
        if (isOpen) next.set(PARAM, "ask")
        else next.delete(PARAM)
        const query = next.toString()
        window.history.pushState(null, "", query === "" ? pathname : `${pathname}?${query}`)
    }
    const tested = view === undefined ? false : (sepaySetupDone(view).find(([id]) => id === "test")?.[1] ?? false)
    return {
        isOffered: view?.environment === "test" && view.status !== "disconnected" && tested && role === "owner",
        isAsking: params.get(PARAM) === "ask",
        isPending,
        accountMasked: view?.accountMasked ?? "",
        ask: () => push(true),
        dismiss: () => push(false),
        confirm: () => {
            setPending(true)
            void commands.setEnvironment("live").then(() => {
                setPending(false)
                push(false)
            })
        },
    }
}
