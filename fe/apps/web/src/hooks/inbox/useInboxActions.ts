"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { useWorkbenchGraphqlAction } from "@/hooks/workbenchHost/useWorkbenchGraphqlAction"
import { QUERY_INBOX_LEAD_SWR_KEY, QUERY_INBOX_LEADS_SWR_KEY, useMutateAssignInboxLeadSwr } from "@/hooks/swr/api"
import { useWorkspaceId } from "@/hooks/workspaces"
import { matchesSwrKey } from "@/modules/utils"

/** What the owner does on the opened customer. */
interface InboxActions {
    /** A decision is on its way to the back end. */
    readonly isDeciding: boolean
    /** The last decision did not go through. */
    readonly decisionFailed: boolean
    readonly approve: (orderId: string) => void
    readonly reject: (orderId: string) => void
    /** Hands the customer to an agent, or takes it back with null. */
    readonly assign: (leadId: string, agentId: string | null) => void
}

/** The decision of the owner on a draft order (the existing sales decision action) and the hand-over of a customer to an agent. */
export const useInboxActions = (): InboxActions => {
    const workspaceId = useWorkspaceId()
    const { mutate } = useSWRConfig()
    const decide = useWorkbenchGraphqlAction("sales.decide")
    const assignment = useMutateAssignInboxLeadSwr(workspaceId ?? "")
    const [decisionFailed, setDecisionFailed] = useState(false)
    const refresh = async (): Promise<void> => {
        await mutate(matchesSwrKey(QUERY_INBOX_LEADS_SWR_KEY))
        await mutate(matchesSwrKey(QUERY_INBOX_LEAD_SWR_KEY))
    }
    const decideOn = (orderId: string, command: "approve" | "reject"): void => {
        void decide.run({ id: orderId, command }).then(async (outcome) => {
            setDecisionFailed(!outcome.ok)
            await refresh()
        })
    }
    return {
        isDeciding: decide.isRunning,
        decisionFailed,
        approve: (orderId) => decideOn(orderId, "approve"),
        reject: (orderId) => decideOn(orderId, "reject"),
        assign: (leadId, agentId) => void assignment.trigger({ leadId, agentId }),
    }
}
