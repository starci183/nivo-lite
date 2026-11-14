"use client"

import { useProviderDocLevel } from "@/hooks/providerOffer"
import { useSlotLabels } from "@/hooks/slot"
import { ProviderMcpTabBase } from "./component"

/** The Mcp tab of a connected account's page: the tools an agent calls (level 2), documented from the registry through `providerOffer`. */
export const ProviderMcpTab = () => {
    const slotLabels = useSlotLabels()
    const read = useProviderDocLevel("mcp")
    return (
        <ProviderMcpTabBase
            props={{ level: read.level, words: read.words, slotLabels: slotLabels(read.level.empty) }}
            on={{ retry: read.retry }}
        />
    )
}
