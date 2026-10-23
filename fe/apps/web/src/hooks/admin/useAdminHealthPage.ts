"use client"

import { useQueryAdminHealthSwr } from "@/hooks/swr"
import { adminFailureOf } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** The platform health page, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminHealthPage = () => {
    const swrRead = useQueryAdminHealthSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return { health: data, isLoading, failure: adminFailureOf(error) }
}
