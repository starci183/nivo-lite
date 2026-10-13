"use client"

import { useQueryAdminHealthSwr } from "@/hooks/swr/api/graphql/queries/useQueryAdminHealthSwr"
import { adminFailureOf } from "./admin.shared"

/** The platform health page, with its loading state and its failure sorted into a 404 or a message. */
export const useAdminHealthPage = () => {
    const { data, error, isLoading } = useQueryAdminHealthSwr()
    return { health: data, isLoading, failure: adminFailureOf(error) }
}
