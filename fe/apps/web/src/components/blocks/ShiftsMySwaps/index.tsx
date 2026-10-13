"use client"

import { useTranslations } from "next-intl"
import { requestStatusOf } from "@/hooks/shifts"
import type { ShiftsMineView } from "@/modules/types"
import { ShiftsMySwapsBase } from "./component"

/** The person's view. */
interface ShiftsMySwapsProps {
    readonly mine: ShiftsMineView
}

const LIST_LIMIT = 8

/** My swap and open-shift requests with their state. */
export const ShiftsMySwaps = (props: ShiftsMySwapsProps) => {
    const t = useTranslations("shifts")
    const name = (id: string | null): string =>
        props.mine.colleagues.find((person) => person.id === id)?.name ?? t("you")
    const lineOf = (kind: string, from: string | null, to: string, shift: string): string =>
        kind === "claim"
            ? t("claimLine", { name: name(to), shift })
            : t("swapLine", { from: name(from), to: name(to), shift })

    return (
        <ShiftsMySwapsBase
            props={{
                title: t("mySwaps"),
                rows: props.mine.swaps.slice(0, LIST_LIMIT).map((swap) => ({
                    id: swap.id,
                    text: lineOf(swap.kind, swap.fromStaffId, swap.toStaffId, swap.shiftLine),
                    tone: requestStatusOf(swap.status).tone,
                    badge: t(requestStatusOf(swap.status).key),
                })),
            }}
        />
    )
}
