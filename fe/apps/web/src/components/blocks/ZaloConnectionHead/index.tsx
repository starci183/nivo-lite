"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloHead } from "@/hooks/zaloConnection"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, zaloConnectionHref } from "@/modules/routes"
import { ZALO_TABS } from "@/modules/types"
import type { ZaloTab } from "@/modules/types"
import { ZaloConnectionHeadBase } from "./component"

/** What the page hands the header: the connection of the url and the tab it asked for. */
interface ZaloConnectionHeadProps {
    readonly connectionId: string
    readonly tab: ZaloTab
}

/** The connected header of a Zalo OA connection: reconnect goes through the existing authorization, disconnect asks first. */
export const ZaloConnectionHead = (props: ZaloConnectionHeadProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notice, reconnect, disconnect, isDisconnecting } = useZaloHead(props.connectionId)
    const [isAsking, setIsAsking] = useState(false)
    const tabLabels: Readonly<Record<ZaloTab, string>> = {
        overview: t("tabOverview"),
        setup: t("tabSetup"),
        check: t("tabCheck"),
        agents: t("tabAgents"),
    }
    return (
        <ZaloConnectionHeadBase
            props={{
                head,
                slotLabels: slotLabels(t("headEmpty")),
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "zalo", label: head.items?.name ?? t("crumbZalo") },
                ],
                reconnectLabel: t("reconnect"),
                disconnectLabel: t("disconnect"),
                tabsLabel: t("tabsLabel"),
                tabs: ZALO_TABS.map((id) => ({ id, label: tabLabels[id] })),
                selectedTab: props.tab,
                notice,
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectQuestion"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: isDisconnecting,
                },
            }}
            on={{
                reconnect: () => void reconnect(),
                askDisconnect: () => setIsAsking(true),
                confirmDisconnect: () => void disconnect(),
                dismiss: () => setIsAsking(false),
                selectTab: (id) => router.replace(zaloConnectionHref(props.connectionId, id)),
                retry: () => router.refresh(),
            }}
        />
    )
}
