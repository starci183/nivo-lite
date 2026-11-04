"use client"

import { notFound } from "next/navigation"
import { useAdminFormat, useAdminHealthCards, useAdminHealthPage } from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { AdminHealthBase } from "./component"

/** The connected platform health page: sign-ups, SePay billing, application errors and recent console activity. */
export const AdminHealth = () => {
    const { text: t } = useAdminFormat()
    const slotLabels = useSlotLabels()
    const { health, isLoading, failure, reload } = useAdminHealthPage()
    const cards = useAdminHealthCards(health)
    if (failure.isMissing) notFound()
    const copy = {
        title: t("healthTitle"),
        description: t("healthDescription"),
    }
    const view = health === undefined ? undefined : { ...copy, cards }
    return (
        <AdminHealthBase
            props={{
                slot: slotOfSwr({ data: view, isLoading, error: failure.message }),
                placeholder: { ...copy, cards },
                labels: { ...slotLabels(t("empty")), error: failure.message ?? t("loadFailed") },
            }}
            on={{ retry: reload }}
        />
    )
}
