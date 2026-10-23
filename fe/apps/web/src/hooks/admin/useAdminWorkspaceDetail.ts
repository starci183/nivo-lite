"use client"

import { useQueryAdminWorkspaceSwr } from "@/hooks/swr"
import { adminFailureOf } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** The read-only overview of one workspace, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceDetail = (workspaceId: string) => {
    const swrRead = useQueryAdminWorkspaceSwr({ workspaceId })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { detail: data, isLoading, failure: adminFailureOf(error) }
}
