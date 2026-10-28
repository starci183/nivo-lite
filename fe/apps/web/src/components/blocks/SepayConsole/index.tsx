"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    SEPAY_TAB_IDS,
    otherEnvironment,
    sepayStatusTone,
    useSepayCommands,
    useSepayConnection,
    useSepayPlaceholder,
    useSepayTab,
} from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SepayConsoleBase } from "./component"
import type { SepayConsoleShape, SepayHeaderView } from "./component"

/** What the page hands the console: the regions already connected to the connection of the url, and the tab the url asked for. */
type SepayConsoleProps = {
    readonly shape: SepayConsoleShape
    readonly connectionId: string
    readonly tab: string | undefined
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
    facts: t("facts", { bank: connection.bank, account: connection.accountMasked }),
    switchLabel: t(otherEnvironment(connection.environment) === "live" ? "switchToLive" : "switchToTest"),
    isDisconnected: connection.status === "disconnected",
})

/** The connected page of a SePay connection: one `Page` with its header (environment switch, disconnect, tabs), the open tab region and the docked live panel. */
export const SepayConsole = (props: SepayConsoleProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const { selected, select } = useSepayTab(props.connectionId, props.tab)
    const tabLabels = { overview: t("tabOverview"), setup: t("tabSetup"), test: t("tabTest"), agents: t("tabAgents") }
    const [isPending, setPending] = useState(false)
    const run = async (action: () => Promise<unknown>) => {
        setPending(true)
        await action()
        setPending(false)
    }
    const connection = slot.items
    return (
        <SepayConsoleBase
            shape={props.shape}
            props={{
                selected,
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
                tabs: {
                    label: t("tabsLabel"),
                    items: SEPAY_TAB_IDS.map((id) => ({ id, label: tabLabels[id] })),
                },
                disconnectLabel: t("disconnect"),
                isPending,
                isOwner: role === "owner",
            }}
            on={{
                retry,
                selectTab: select,
                switchEnvironment: () => {
                    if (connection !== undefined)
                        void run(() => commands.setEnvironment(otherEnvironment(connection.environment)))
                },
                disconnect: () => void run(commands.disconnect),
            }}
        />
    )
}
