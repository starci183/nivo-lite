"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workspaceHref } from "@/modules/routes"
import { CONNECTION_ROUTES } from "./connections.shared"
import { useConnectionsRole } from "./useConnectionsRole"

/**
 * The notice a provider page draws for a member who is neither owner nor manager, in place of a page whose every read would be refused;
 * undefined for anyone else and while the role is on its way.
 */
export const useConnectionRefusal = ():
    | {
          title: string
          crumbLabel: string
          homeLabel: string
          homeHref: string
          message: string
          description: string
      }
    | undefined => {
    const t = useTranslations("connections")
    const { role, isLoading } = useConnectionsRole()
    const workspaceId = useWorkspaceId()
    if (isLoading || role === undefined || role === "owner" || role === "manager") return undefined
    return {
        title: t("title"),
        crumbLabel: t("crumbLabel"),
        homeLabel: t("crumbHome"),
        homeHref: workspaceHref(workspaceId, CONNECTION_ROUTES.workspaceHome),
        message: t("forbiddenTitle"),
        description: t("forbiddenBody"),
    }
}
