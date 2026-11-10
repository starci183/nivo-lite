"use client"

import { useMemo } from "react"
import { useQueryInboxLeadSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { RunDetailContext } from "@/modules/agentRuns"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"

/** The ids of a run that name a customer, an order and a conversation, by the key they sit under. */
const LEAD_KEYS: ReadonlySet<string> = new Set(["leadId", "customerId", "contactId"])
const ORDER_KEYS: ReadonlySet<string> = new Set(["orderId", "lastOrderId"])
const CONVERSATION_KEYS: ReadonlySet<string> = new Set(["conversationId", "threadId"])

/**
 * The words of the run's context with the names of the entities its values point at: the customer the run is about (read from the
 * inbox) gives the name of a customer id, the order number of an order id, and channel and name for a conversation id.
 */
export const useRunEntityContext = (base: RunDetailContext, leadId: string | null): RunDetailContext => {
    const workspaceId = useWorkspaceId()
    const lead = useQueryInboxLeadSwr(workspaceId, leadId === "" ? null : leadId)
    return useMemo(() => {
        const detail = lead.data
        if (detail === undefined) return base
        const inboxHref = workspaceHref(workspaceId, CONSOLE_ROUTES.inbox)
        const channel = base.has(`channel_${detail.lead.channel}`) ? base.t(`channel_${detail.lead.channel}`) : detail.lead.channel
        return {
            ...base,
            entityOf: (key: string, value: string) => {
                if (LEAD_KEYS.has(key) && value === detail.lead.id) return { label: detail.lead.name, href: inboxHref }
                if (ORDER_KEYS.has(key)) {
                    const order = detail.orders.find((entry) => entry.id === value)
                    return order === undefined ? null : { label: order.orderNo, href: inboxHref }
                }
                if (CONVERSATION_KEYS.has(key))
                    return { label: `${channel} · ${detail.lead.name}`, href: base.chatHref ?? inboxHref }
                return null
            },
        }
    }, [base, lead.data, workspaceId])
}
