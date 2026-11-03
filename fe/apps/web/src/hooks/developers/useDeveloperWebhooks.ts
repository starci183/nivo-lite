"use client"

import { useMemo } from "react"
import { useConnectionsData } from "@/hooks/connections"
import { useMember } from "@/hooks/member"
import { mapSlot } from "@/hooks/slot"
import type { Connection, DataSlot } from "@/modules/types"

/** The view `useDeveloperWebhooks` returns. */
export interface DeveloperWebhooksView {
    webhooks: Connection[]
    canManage: boolean
    /** Where the connections read stands: the list draws its loading, failure and retry from it, never an empty "not connected". */
    read: DataSlot<true>
    retry: () => void
}

/** The outgoing webhooks of the active workspace, read from the back end `connections` query, whether the signed-in member may manage them (owner only), and the state of the read. */
export const useDeveloperWebhooks = (): DeveloperWebhooksView => {
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
