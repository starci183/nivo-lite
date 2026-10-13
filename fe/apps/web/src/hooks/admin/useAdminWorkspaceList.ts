"use client"

import { useQueryAdminWorkspacesSwr } from "@/hooks/swr/api/graphql/queries/useQueryAdminWorkspacesSwr"
import { adminFailureOf } from "./admin.shared"
import type { AdminWorkspaceFilter } from "./admin.shared"

/** The workspace list for a filter and a search, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminWorkspaceList = (filter: AdminWorkspaceFilter, query: string) => {
    const { data, error, isLoading } = useQueryAdminWorkspacesSwr({ filter, query })
    return { list: data, isLoading, failure: adminFailureOf(error) }
}
