"use client"

import { useMemo } from "react"
import { useWaitingFactCount } from "@/hooks/brain"
import { useQueryProviderRightsSwr } from "@/hooks/swr"

/** What the header of an agent counts: the connected accounts attached to it and the facts that wait for a decision. */
export interface InstanceCounts {
    /** How many connected accounts are attached to the agent (one per account, two SePay accounts count two); undefined while they load. */
    readonly grants: number | undefined
    /** How many facts of the Second Brain wait for the owner; undefined while the brain loads. */
    readonly waitingFacts: number | undefined
}

/** The accounts attached to an agent (`providerRights`) and the waiting facts of the Second Brain, read through the shared reads the rights and knowledge tabs also use. */
export const useInstanceCounts = (agentId: string | null): InstanceCounts => {
    const rights = useQueryProviderRightsSwr(agentId !== null)
    const waiting = useWaitingFactCount()
    const grants = useMemo(
        () =>
            rights.data === undefined
                ? undefined
                : new Set(rights.data.attachments.filter((one) => one.agentId === agentId).map((one) => one.connectionId)).size,
        [rights.data, agentId],
    )
    return {
        grants,
        waitingFacts: "items" in waiting.slot ? waiting.slot.items : undefined,
    }
}
