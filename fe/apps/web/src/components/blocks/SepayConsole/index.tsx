"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { sepayStatusTone, useSepayCommands, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal, useConnectionsRole } from "@/hooks/connections"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { SepayConsoleBase } from "./component"
import type { SepayHeaderView } from "./component"

/** What the page hands the head band: the connection of the url and where the back control leads. */
type SepayConsoleProps = {
    readonly connectionId: string
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
})

/**
 * The connected head band of a SePay connection page (status, environment, facts) and the owner disconnect, which asks first and
 * returns to the Connections page once it is done.
 */
export const SepayConsole = (props: SepayConsoleProps) => {
    const t = useTranslations("sepayConnection")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const { slot, isMissing } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const [isAsking, setAsking] = useState(false)
    const connection = "items" in slot ? slot.items : undefined
    const refusal = useConnectionRefusal()
    if (isMissing && refusal === undefined) notFound()
    const canDisconnect = role === "owner" && connection !== undefined && connection.status !== "disconnected"
    return (
        <SepayConsoleBase
            props={{
                view: connection === undefined ? viewOf(t, placeholder) : viewOf(t, connection),
                isLoading: "isLoading" in slot,
                markSrc: PROVIDER_LOGO.sepay ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                backLabel: pane.backToList,
                moreLabel: pane.moreActions,
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
                back: () => router.push(props.hubHref),
            }}
        />
    )
}
