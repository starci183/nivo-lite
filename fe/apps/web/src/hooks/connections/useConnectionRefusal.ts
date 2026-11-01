"use client"

import { useTranslations } from "next-intl"
import { CONNECTION_ROUTES } from "./connections.shared"
import { useConnectionsRole } from "./useConnectionsRole"

/**
 * The notice a provider page draws for a member who is neither owner nor manager, in place of a page whose every read would be refused;
 * undefined for anyone else and while the role is on its way.
 */
export const useConnectionRefusal = () => {
    const t = useTranslations("connections")
    const { role, isLoading } = useConnectionsRole()
    if (isLoading || role === undefined || role === "owner" || role === "manager") return undefined
    return {
        title: t("title"),
        crumbLabel: t("crumbLabel"),
        homeLabel: t("crumbHome"),
        homeHref: CONNECTION_ROUTES.dashboard,
        message: t("forbiddenTitle"),
        description: t("forbiddenBody"),
    }
}
