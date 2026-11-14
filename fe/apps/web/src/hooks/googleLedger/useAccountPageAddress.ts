"use client"

import { useParams } from "next/navigation"
import { useWorkspaceId } from "@/hooks/workspaces"
import { providerPagePath } from "@/modules/connection-page"
import { workspaceHref } from "@/modules/routes"

/** The address of the connected account's page the browser is on: where Google sends the owner back after a consent asked from that page. */
export const useAccountPageAddress = (): string => {
    const workspaceId = useWorkspaceId()
    const route = useParams<{ id?: string }>()
    return workspaceHref(workspaceId, providerPagePath(typeof route.id === "string" ? route.id : ""))
}
