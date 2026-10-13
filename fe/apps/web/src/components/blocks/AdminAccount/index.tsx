"use client"

import { notFound } from "next/navigation"
import { useAdminSession } from "@/hooks/admin"
import { AdminAccountBase } from "./component"

/**
 * The connected account name of the console bar: the platform admin the back end knows the caller as. Anyone the back end does
 * not know as one gets a 404 for the whole console, so it is not discoverable.
 */
export const AdminAccount = () => {
    const session = useAdminSession()
    if (session.isMissing) notFound()
    return session.email === undefined ? null : <AdminAccountBase props={{ email: session.email }} />
}
