"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { mapSlot } from "@/hooks/slot"
import type { SepayConnectionView } from "@/modules/types"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"

/** The three health tiles of a SePay connection, worded, with the slot they come from and a same-shape placeholder. */
export const useSepayHealthTiles = (connectionId: string) => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const placeholder = useSepayPlaceholder()
    const { slot, retry } = useSepayConnection(connectionId)
    const tilesOf = (connection: SepayConnectionView): ReadonlyArray<DescriptionListStatItem> => {
        const last = connection.health.lastWebhookAt
        return [
            {
                id: "last",
                term: t("tileLast"),
                description: last === null ? t("tileNever") : format.relativeTime(new Date(last)),
            },
            {
                id: "valid",
                term: t("tileValid"),
                description: `${connection.health.validCount}/${connection.health.totalCount}`,
            },
            { id: "duplicates", term: t("tileDuplicates"), description: String(connection.health.duplicateCount) },
        ]
    }
    return { slot: mapSlot(slot, tilesOf), placeholder: tilesOf(placeholder), retry }
}
