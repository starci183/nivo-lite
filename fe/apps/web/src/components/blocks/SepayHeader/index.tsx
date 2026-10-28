"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    otherEnvironment,
    sepayStatusTone,
    useSepayCommands,
    useSepayConnection,
    useSepayPlaceholder,
} from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SepayHeaderBase } from "./component"
import type { SepayHeaderView } from "./component"

/** What the page hands the header: the connection of the url. */
type SepayHeaderProps = { readonly connectionId: string; readonly homeHref: string; readonly hubHref: string }

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

/** The connected header of the SePay connection page: environment switch and disconnect on the real data. */
export const SepayHeader = (props: SepayHeaderProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const run = async (action: () => Promise<unknown>) => {
        setPending(true)
        await action()
        setPending(false)
    }
    const connection = slot.items
    return (
        <SepayHeaderBase
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
                disconnectLabel: t("disconnect"),
                isPending,
                isOwner: role === "owner",
            }}
            on={{
                retry,
                switchEnvironment: () => {
                    if (connection !== undefined)
                        void run(() => commands.setEnvironment(otherEnvironment(connection.environment)))
                },
                disconnect: () => void run(commands.disconnect),
            }}
        />
    )
}
