"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useSepayHealthTiles } from "@/hooks/sepayConnection"
import { SepayHealthBase } from "./component"

/** What the page hands the tiles: the connection of the url. */
type SepayHealthProps = { readonly connectionId: string }

/** The connected health tiles of the SePay connection. */
export const SepayHealth = (props: SepayHealthProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const tiles = useSepayHealthTiles(props.connectionId)
    return (
        <SepayHealthBase
            props={{
                title: t("healthTitle"),
                slot: tiles.slot,
                placeholder: tiles.placeholder,
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry: tiles.retry }}
        />
    )
}
