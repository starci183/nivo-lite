"use client"

import { useQueryAdminSessionSwr } from "@/hooks/swr/api/graphql/queries/useQueryAdminSessionSwr"
import { adminFailureOf } from "./admin.shared"

/** Who the back end knows the caller as in the console: the admin e-mail, a 404 flag for everyone else, or a failure. */
export const useAdminSession = () => {
    const { data, error } = useQueryAdminSessionSwr()
    const failure = adminFailureOf(error)
    return { email: data?.email, isMissing: failure.isMissing, error: failure.error }
}
