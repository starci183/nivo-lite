"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { navigation } from "@/modules/i18n"
import type { Provider } from "@/modules/types"
import { URL_PARAMS } from "./connections.shared"

/** The search params an OAuth return (Zalo, Meta, Google) leaves in the URL besides the overlay params. */
const RETURN_PARAMS = ["id", "zalo", "meta", "google"] as const

/** The commands the console's overlays share: open or close the wizard and the connector detail, switch the tab. State lives in the URL. */
export interface ConnectionOverlays {
    readonly openWizard: (provider: Provider, connectionId?: string) => void
    readonly closeWizard: () => void
    readonly openDetail: (connectorId: string) => void
    readonly closeDetail: () => void
    readonly setTab: (tab: string) => void
}

/**
 * The URL is the one place the open overlay lives, so a row, a library card and a drawer in different blocks agree without
 * sharing state, and a refresh or a shared link reopens the same drawer. Pushes use the history API so no server render runs.
 */
export const useConnectionOverlays = (): ConnectionOverlays => {
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    const current = useSearchParams()

    const push = useCallback(
        (change: (params: URLSearchParams) => void) => {
            const next = new URLSearchParams(current.toString())
            change(next)
            const query = next.toString()
            window.history.pushState(null, "", query === "" ? pathname : `${pathname}?${query}`)
        },
        [current, pathname],
    )

    const openWizard = useCallback(
        (provider: Provider, connectionId?: string) =>
            push((params) => {
                params.set(URL_PARAMS.connect, provider)
                if (connectionId === undefined) params.delete(URL_PARAMS.connection)
                else params.set(URL_PARAMS.connection, connectionId)
                params.delete(URL_PARAMS.detail)
            }),
        [push],
    )
    const closeWizard = useCallback(
        () =>
            push((params) => {
                params.delete(URL_PARAMS.connect)
                params.delete(URL_PARAMS.connection)
                for (const name of RETURN_PARAMS) params.delete(name)
            }),
        [push],
    )
    const openDetail = useCallback(
        (connectorId: string) => push((params) => params.set(URL_PARAMS.detail, connectorId)),
        [push],
    )
    const closeDetail = useCallback(() => push((params) => params.delete(URL_PARAMS.detail)), [push])
    const setTab = useCallback(
        (tab: string) => {
            const next = new URLSearchParams(current.toString())
            next.set(URL_PARAMS.tab, tab)
            router.replace(`${pathname}?${next.toString()}`, { scroll: false })
        },
        [current, pathname, router],
    )

    return { openWizard, closeWizard, openDetail, closeDetail, setTab }
}
