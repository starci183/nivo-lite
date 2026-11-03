"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { Figure } from "@starci/grammar/common"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, SepayConnectionView } from "@/modules/types"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"

type UseSepayHealthTilesResult = {
    slot: DataSlot<readonly Figure[]>
    placeholder: readonly Figure[]
    retry: () => void
}

/** The three health tiles of a SePay connection, worded, with the slot they come from and a same-shape placeholder. */
export const useSepayHealthTiles = (connectionId: string): UseSepayHealthTilesResult => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const placeholder = useSepayPlaceholder()
    const { slot, retry } = useSepayConnection(connectionId)
    const tilesOf = (connection: SepayConnectionView): ReadonlyArray<Figure> => {
        const last = connection.health.lastWebhookAt
        return [
            {
                id: "last",
                term: t("tileLast"),
                value: last === null ? t("tileNever") : format.relativeTime(new Date(last), new Date()),
            },
            {
                id: "valid",
                term: t("tileValid"),
                value: `${connection.health.validCount}/${connection.health.totalCount}`,
            },
            { id: "duplicates", term: t("tileDuplicates"), value: String(connection.health.duplicateCount) },
        ]
    }
    return { slot: mapSlot(slot, tilesOf), placeholder: tilesOf(placeholder), retry }
}
