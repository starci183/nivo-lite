"use client"

import { notFound } from "next/navigation"
import { useAdminFormat, useAdminHealthCards, useAdminHealthPage } from "@/hooks/admin"
import { AdminHealthBase } from "./component"

/** The connected platform health page: sign-ups, SePay billing, application errors and recent console activity. */
export const AdminHealth = () => {
    const { text: t } = useAdminFormat()
    const { health, isLoading, failure } = useAdminHealthPage()
    const cards = useAdminHealthCards(health)
    if (failure.isMissing) notFound()
    return (
        <AdminHealthBase
            props={{
                load: { isLoading, error: failure.message, failedTitle: t("loadFailed") },
                view:
                    health === undefined || cards === undefined
                        ? undefined
                        : {
                              eyebrow: t("healthEyebrow"),
                              title: t("healthTitle"),
                              description: t("healthDescription"),
                              cards,
                          },
            }}
        />
    )
}
