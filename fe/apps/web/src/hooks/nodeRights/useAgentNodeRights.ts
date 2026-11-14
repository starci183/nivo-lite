"use client"

import { useLocale } from "next-intl"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryAgentNodeRightsSwr } from "@/hooks/swr"
import type { AgentNodeRightsView, NodeRightsRead } from "@/modules/types"
import { agentNodeRightsOf } from "./nodeRights.shared"
import { useNodeRightsWords } from "./useNodeRightsWords"
import { useStepHrefOf } from "./useStepHrefOf"

/**
 * One agent's node rights (accounts with what each offers, the roll-up rows: the mode of each node), for the agent › rights page, the
 * node panel and the handover step. Pass `null` while the agent is not known.
 */
export const useAgentNodeRights = (agentId: string | null): NodeRightsRead<AgentNodeRightsView> => {
    const locale = useLocale()
    const words = useNodeRightsWords()
    const hrefOf = useStepHrefOf()
    const read = useQueryAgentNodeRightsSwr(agentId)
    return {
        slot: mapSlot(slotOfSwr(read), (wire) => agentNodeRightsOf(wire, words, locale, hrefOf)),
        retry: () => void read.mutate(),
    }
}
