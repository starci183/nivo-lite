"use client"

import { useMemo } from "react"
import { useConnectionsData } from "@/hooks/connections"
import { useMember } from "@/hooks/member"

/** The outgoing webhooks of the active workspace, read from the back end `connections` query, and whether the signed-in member may manage them (owner only). */
export const useDeveloperWebhooks = () => {
    const member = useMember()
    const data = useConnectionsData()
    const webhooks = useMemo(() => data.items.filter((item) => item.provider === "webhook"), [data.items])
    return { webhooks, canManage: member?.role === "owner" }
}
