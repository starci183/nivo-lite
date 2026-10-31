"use client"

import { useDriveTiles } from "@/hooks/drive"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramTiles } from "@/hooks/telegramConnection"
import { ConnectionHealthTilesBase } from "./component"

/** Which provider the tiles serve: the Telegram bot of the url, or the workspace's Google Drive grant. */
type ConnectionHealthTilesProps =
    | { readonly kind: "telegram"; readonly connectionId: string }
    | { readonly kind: "drive" }

/** The connected health tiles band of a provider page; the hooks of the provider it does not serve read nothing. */
export const ConnectionHealthTiles = (props: ConnectionHealthTilesProps) => {
    const slotLabels = useSlotLabels()
    const telegram = useTelegramTiles(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDriveTiles(props.kind === "drive")
    const tiles = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionHealthTilesBase
            props={{ facts: tiles.facts, slotLabels: slotLabels(tiles.emptyLabel) }}
            on={{ retry: tiles.retry }}
        />
    )
}
