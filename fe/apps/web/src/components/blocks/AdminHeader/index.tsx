"use client"

import { useAdminHeader } from "@/hooks/admin"
import { AdminHeaderBase } from "./component"

/** The connected console bar: title, destinations, language, appearance and the account menu. */
export const AdminHeader = () => {
    const header = useAdminHeader()
    return <AdminHeaderBase props={header.props} on={header.on} />
}
