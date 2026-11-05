"use client"

import { notFound } from "next/navigation"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDrivePageHead } from "@/hooks/drive"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useTelegramPageHead } from "@/hooks/telegramConnection"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ConnectionPageHeadBase } from "./component"

/** Which provider the band serves: the Telegram bot of the url, or the workspace Google Drive grant (one per workspace, so no id). */
type ConnectionPageHeadProps = { readonly kind: "telegram"; readonly connectionId: string } | { readonly kind: "drive" }

/**
 * The connected head band of a provider connection page: the name and state, the one command, and the owner disconnect, which asks
 * first. An id that is no Telegram connection of the workspace is `notFound()` once. The hooks of both providers run, as hooks must,
 * and the one that serves another provider reads nothing.
 */
export const ConnectionPageHead = (props: ConnectionPageHeadProps) => {
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const telegram = useTelegramPageHead(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDrivePageHead(props.kind === "drive")
    const refusal = useConnectionRefusal()
    if (props.kind === "telegram" && telegram.isMissing && refusal === undefined) notFound()
    const { view, on } = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionPageHeadBase
            props={{
                ...(view.head === undefined ? {} : { head: view.head }),
                isLoading: view.isLoading,
                icon: view.icon,
                ...(view.action === undefined ? {} : { action: view.action }),
                ...(view.disconnect === undefined ? {} : { disconnect: view.disconnect }),
                confirm: view.confirm,
                backLabel: pane.backToList,
                moreLabel: pane.moreActions,
                railLabel: view.rail.openLabel,
                markSrc: PROVIDER_LOGO[props.kind === "telegram" ? "telegram" : "google_drive"] ?? "",
                ...(refusal === undefined ? {} : { refusal }),
            }}
            on={{
                act: on.act,
                askDisconnect: on.askDisconnect,
                confirmDisconnect: on.confirmDisconnect,
                dismiss: on.dismiss,
                back: () => router.push(CONSOLE_ROUTES.connections),
            }}
        />
    )
}
