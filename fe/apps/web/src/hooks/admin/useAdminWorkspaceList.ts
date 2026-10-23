"use client"

import { useQueryAdminWorkspacesSwr } from "@/hooks/swr"
import { adminFailureOf } from "./admin.shared"
import type { AdminWorkspaceFilter } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** The workspace list for a filter and a search, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceList = (filter: AdminWorkspaceFilter, query: string) => {
    const swrRead = useQueryAdminWorkspacesSwr({ filter, query })
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { list: data, isLoading, failure: adminFailureOf(error) }
}
