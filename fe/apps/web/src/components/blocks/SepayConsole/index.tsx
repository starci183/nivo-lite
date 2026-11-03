"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import {
    sepayStatusTone,
    useSepayCommands,
    useSepayConnection,
    useSepayEventsView,
    useSepayPlaceholder,
} from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal, useConnectionsRole, wizardQuery } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { SepayConsoleBase } from "./component"
import type { SepayHeaderView } from "./component"

/** What the page hands the frame: the connection of the url, where the trail leads, and the bands of the main pane as children. */
type SepayConsoleProps = {
    readonly children: ReactNode
    readonly connectionId: string
    readonly homeHref: string
    readonly hubHref: string
}

const viewOf = (
    t: ReturnType<typeof useTranslations<"sepayConnection">>,
    connection: SepayConnectionView,
): SepayHeaderView => ({
    name: connection.name,
    statusLabel: t(`status_${connection.status}`),
    statusTone: sepayStatusTone(connection.status),
    environmentLabel: t(connection.environment === "test" ? "envTest" : "envLive"),
    environmentTone: connection.environment === "test" ? "warning" : "success",
    facts: t("facts", { bank: connection.bank, account: `${connection.accountMasked} · ${connection.holder}` }),
    lastError: connection.lastError ?? "",
})

type SepayTranslate = ReturnType<typeof useTranslations<"sepayConnection">>

/** The way back from a disconnected connection: the Connections page with the SePay wizard open. */
const reconnectOf = (t: SepayTranslate, hubHref: string) => ({
    title: t("disconnectedTitle"),
    description: t("disconnectedBody"),
    label: t("reconnect"),
    href: `${hubHref}?${wizardQuery("sepay")}`,
})

/**
 * The connected frame of a SePay connection page: the header (status, environment, facts), the main pane and the live rail, and the
 * owner's disconnect, which asks first and returns to the Connections page once it is done.
 */
export const SepayConsole = (props: SepayConsoleProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { slot, retry, isMissing } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const rail = useSepayEventsView(props.connectionId)
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const [isAsking, setAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const connection = "items" in slot ? slot.items : undefined
    const refusal = useConnectionRefusal()
    if (isMissing && refusal === undefined) notFound()
    const canDisconnect = role === "owner" && connection !== undefined && connection.status !== "disconnected"
    return (
        <SepayConsoleBase
            children={props.children}
            props={{
                slot: mapSlot(slot, (items) => viewOf(t, items)),
                placeholder: viewOf(t, placeholder),
                labels: slotLabels(t("loadFailed")),
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: props.homeHref },
                    { id: "connections", label: t("crumbConnections"), href: props.hubHref },
                    { id: "sepay", label: connection?.name ?? t("title") },
                ],
                markSrc: PROVIDER_LOGO.sepay ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                gridLabel: t("title"),
                mainLabel: t("mainLabel"),
                rail: {
                    label: t("eventsTitle"),
                    openLabel: t("eventsOpen"),
                    closeLabel: t("eventsClose"),
                    isOpen: isRailOpen,
                },
                errorTitle: t("lastErrorTitle"),
                events: rail.events,
                ...(connection?.status === "disconnected" ? { reconnect: reconnectOf(t, props.hubHref) } : {}),
                ...(canDisconnect
                    ? {
                          disconnect: {
                              title: t("disconnect"),
                              description: t("disconnectBody"),
                              label: t("disconnectEntry"),
                          },
                      }
                    : {}),
                isPending,
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectTitle"),
                    description: t("disconnectBody"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                },
            }}
            on={{
                retry,
                askDisconnect: () => setAsking(true),
                confirmDisconnect: () => {
                    setPending(true)
                    void commands.disconnect().then((settled) => {
                        setPending(false)
                        setAsking(false)
                        if (settled.kind === "ok") router.replace(props.hubHref)
                    })
                },
                dismiss: () => setAsking(false),
                openRail: setRailOpen,
                retryEvents: rail.retry,
            }}
        />
    )
}
