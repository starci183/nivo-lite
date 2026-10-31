"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { sepayStatusTone, useSepayCommands, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { SepayConsoleBase } from "./component"
import type { SepayConsoleShape, SepayHeaderView } from "./component"

/** What the page hands the frame: the bands already connected to the connection of the url, and where the trail leads. */
type SepayConsoleProps = {
    readonly shape: SepayConsoleShape
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
    isDisconnected: connection.status === "disconnected",
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
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const [isAsking, setAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const connection = slot.items
    if (isMissing) notFound()
    const canDisconnect = role === "owner" && connection !== undefined && connection.status !== "disconnected"
    return (
        <SepayConsoleBase
            shape={props.shape}
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
                gridLabel: t("title"),
                mainLabel: t("mainLabel"),
                rail: {
                    label: t("eventsTitle"),
                    openLabel: t("eventsOpen"),
                    closeLabel: t("eventsClose"),
                    isOpen: isRailOpen,
                },
                errorTitle: t("lastErrorTitle"),
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
            }}
        />
    )
}
