"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloChecks, useZaloEventsView, useZaloHead, useZaloPage } from "@/hooks/zaloConnection"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ZaloConnectionHeadBase } from "./component"
import type { ZaloPageNotice } from "./component"

/** What the page hands the frame: the connection of the url and the connected bands of its main pane. */
interface ZaloConnectionHeadProps {
    readonly connectionId: string
    readonly children: ReactNode
}

/**
 * The connected frame of a Zalo OA connection page: the header with "Check again", the notices (why the OA cannot send, a refused
 * command, the first message it still waits for), the main pane, the live rail and the owner's disconnect, which asks first.
 */
export const ZaloConnectionHead = (props: ZaloConnectionHeadProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notice, disconnect, isDisconnecting, isMissing, isOwner, statusKind } = useZaloHead(
        props.connectionId,
    )
    const { recheck, isRechecking } = useZaloChecks(props.connectionId)
    const { slot } = useZaloPage(props.connectionId)
    const rail = useZaloEventsView(props.connectionId)
    const page = "items" in slot ? slot.items : undefined
    const [isAsking, setIsAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const refusal = useConnectionRefusal()
    if (isMissing && refusal === undefined) notFound()
    const banner = ("items" in head ? head.items : undefined)?.banner ?? ""
    const notices: ReadonlyArray<ZaloPageNotice> = [
        ...(banner === "" ? [] : [{ id: "banner", tone: "negative" as const, title: banner }]),
        ...(notice === "" ? [] : [{ id: "notice", tone: "negative" as const, title: notice }]),
        ...(statusKind === "waiting"
            ? [{ id: "waiting", tone: "informative" as const, title: t("waitingTitle"), description: t("waitingBody") }]
            : []),
    ]
    const isLive = page !== undefined && page.status !== "disconnected"
    return (
        <ZaloConnectionHeadBase
            children={props.children}
            props={{
                head,
                markSrc: PROVIDER_LOGO.zalo_oa ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                slotLabels: slotLabels(t("headEmpty")),
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "zalo", label: ("items" in head ? head.items : undefined)?.name ?? t("crumbZalo") },
                ],
                gridLabel: t("title"),
                mainLabel: t("mainLabel"),
                rail: {
                    label: t("eventsTitle"),
                    openLabel: t("eventsOpen"),
                    closeLabel: t("eventsClose"),
                    isOpen: isRailOpen,
                },
                events: rail.events,
                recheckLabel: t("recheck"),
                isRechecking,
                notices,
                ...(isOwner && isLive
                    ? {
                          disconnect: {
                              title: t("disconnectTitle"),
                              description: t("disconnectBody"),
                              label: t("disconnectEntry"),
                          },
                      }
                    : {}),
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectQuestion"),
                    description: t("disconnectBody"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: isDisconnecting,
                },
            }}
            on={{
                recheck: () => void recheck(),
                askDisconnect: () => setIsAsking(true),
                confirmDisconnect: () => void disconnect(),
                dismiss: () => setIsAsking(false),
                openRail: setRailOpen,
                retry: () => router.refresh(),
                retryEvents: rail.retry,
            }}
        />
    )
}
