"use client"

import { useQueryAdminWorkspaceSwr } from "@/hooks/swr"
import { adminFailureOf } from "./admin.shared"

/** The read-only overview of one workspace, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceDetail = (workspaceId: string) => {
    const { data, error, isLoading } = useQueryAdminWorkspaceSwr({ workspaceId })
    return { detail: data, isLoading, failure: adminFailureOf(error) }
}
