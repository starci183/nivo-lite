"use client"

import { useQueryAdminSessionSwr } from "@/hooks/swr"
import { adminFailureOf } from "./admin.shared"
import { readError } from "@/hooks/workspaceread"

/** Who the back end knows the caller as in the console: the admin e-mail, a 404 flag for everyone else, or a failure. */
export const useAdminSession = () => {
    const swrRead = useQueryAdminSessionSwr()
    const { data } = swrRead
    const error = readError(swrRead)
    const failure = adminFailureOf(error)
    return { email: data?.email, isMissing: failure.isMissing, error: failure.error }
}
