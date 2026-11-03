"use client"

import { useMemo } from "react"
import { useConnectionsData } from "@/hooks/connections"
import { useMember } from "@/hooks/member"
import { mapSlot } from "@/hooks/slot"

/** The outgoing webhooks of the active workspace, read from the back end `connections` query, whether the signed-in member may manage them (owner only), and the state of the read. */
export const useDeveloperWebhooks = () => {
    const member = useMember()
    const data = useConnectionsData()
    const webhooks = useMemo(() => data.items.filter((item) => item.provider === "webhook"), [data.items])
    return {
        webhooks,
        canManage: member?.role === "owner",
        /** Where the connections read stands: the list draws its loading, failure and retry from it, never an empty "not connected". */
        read: mapSlot(data.slot, (): true => true),
        retry: data.retry,
    }
}
