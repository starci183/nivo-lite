"use client"

import { useTranslations } from "next-intl"
import { requestStatusOf, useShiftsMineData } from "@/hooks/shifts"
import { ShiftsMySwapsBase } from "./component"

const LIST_LIMIT = 8

/** My swap and open-shift requests with their state. */
export const ShiftsMySwaps = () => {
    const t = useTranslations("shifts")
    const mine = useShiftsMineData().data
    if (mine?.profileId === undefined || mine.profileId === null) return null

    const name = (id: string | null): string => mine.colleagues.find((person) => person.id === id)?.name ?? t("you")
    const lineOf = (kind: string, from: string | null, to: string, shift: string): string =>
        kind === "claim"
            ? t("claimLine", { name: name(to), shift })
            : t("swapLine", { from: name(from), to: name(to), shift })

    return (
        <ShiftsMySwapsBase
            props={{
                title: t("mySwaps"),
                rows: mine.swaps.slice(0, LIST_LIMIT).map((swap) => ({
                    id: swap.id,
                    text: lineOf(swap.kind, swap.fromStaffId, swap.toStaffId, swap.shiftLine),
                    tone: requestStatusOf(swap.status).tone,
                    badge: t(requestStatusOf(swap.status).key),
                })),
            }}
        />
    )
}
