"use client"

import { notFound } from "next/navigation"
import { useAdminFormat, useAdminHealthCards, useAdminHealthPage } from "@/hooks/admin"
import type { AdminCardView } from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { AdminHealthBase } from "./component"

/** The health cards drawn while the read is on its way: four cards of two rows, the shape of the finished page. */
const PLACEHOLDER_CARDS: ReadonlyArray<AdminCardView> = ["signups", "billing", "errors", "activity"].map((id) => ({
    id,
    label: id,
    emptyMessage: id,
    labelBadges: [],
    rows: ["first", "second"].map((row) => ({ id: `${id}-${row}`, title: row, lines: [row], badges: [] })),
}))

/** The connected platform health page: sign-ups, SePay billing, application errors and recent console activity. */
export const AdminHealth = () => {
    const { text: t } = useAdminFormat()
    const slotLabels = useSlotLabels()
    const { health, isLoading, failure, reload } = useAdminHealthPage()
    const cards = useAdminHealthCards(health)
    if (failure.isMissing) notFound()
    const copy = {
        eyebrow: t("healthEyebrow"),
        title: t("healthTitle"),
        description: t("healthDescription"),
    }
    const view = health === undefined || cards === undefined ? undefined : { ...copy, cards }
    return (
        <AdminHealthBase
            props={{
                slot: slotOfSwr({ data: view, isLoading, error: failure.message }),
                placeholder: { ...copy, cards: PLACEHOLDER_CARDS },
                slotLabels: { ...slotLabels(t("empty")), error: failure.message ?? t("loadFailed") },
            }}
            on={{ retry: reload }}
        />
    )
}
