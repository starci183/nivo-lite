"use client"

import { useMemo } from "react"
import { useWaitingFactCount } from "@/hooks/brain"
import { useQueryAgentConnectionsSwr } from "@/hooks/swr"

/** What the header of an agent counts: the connections it was granted and the facts that wait for a decision. */
export interface InstanceCounts {
    /** The accounts the agent may use, each named once; undefined while they load. */
    readonly grantedNames: ReadonlyArray<string> | undefined
    /** How many grants the agent holds; undefined while they load. */
    readonly grants: number | undefined
    /** How many facts of the Second Brain wait for the owner; undefined while the brain loads. */
    readonly waitingFacts: number | undefined
}

/** The grants of an agent and the waiting facts of the Second Brain, read through the shared reads the connections and knowledge tabs also use. */
export const useInstanceCounts = (agentId: string | null): InstanceCounts => {
    const granted = useQueryAgentConnectionsSwr(agentId === null ? null : { agentId })
    const waiting = useWaitingFactCount()
    const grantedNames = useMemo(
        () => (granted.data === undefined ? undefined : [...new Set(granted.data.map((connection) => connection.name))]),
        [granted.data],
    )
    return {
        grantedNames,
        grants: granted.data === undefined ? undefined : granted.data.length,
        waitingFacts: "items" in waiting.slot ? waiting.slot.items : undefined,
    }
}
