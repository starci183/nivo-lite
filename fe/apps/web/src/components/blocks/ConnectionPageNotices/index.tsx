"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useDrivePageHead } from "@/hooks/drive"
import { useTelegramPageHead } from "@/hooks/telegramConnection"
import { ConnectionPageNoticesBase } from "./component"

/** Which provider the notices serve: the Telegram bot of the url, or the workspace Google Drive grant. */
type ConnectionPageNoticesProps =
    { readonly kind: "telegram"; readonly connectionId: string } | { readonly kind: "drive" }

/** The connected notices of a provider connection page: why it cannot work, a refused command, the one step left. */
export const ConnectionPageNotices = (props: ConnectionPageNoticesProps) => {
    const telegram = useTelegramPageHead(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDrivePageHead(props.kind === "drive")
    const refusal = useConnectionRefusal()
    const { view } = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionPageNoticesBase props={{ notices: view.notices, ...(refusal === undefined ? {} : { refusal }) }} />
    )
}
