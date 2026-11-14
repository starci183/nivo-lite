"use client"

import { useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { AgentProfileView, RegionView } from "./agentProfile.shared"
import { useAgentProfile } from "./useAgentProfile"

/**
 * One region of the profile page (tags, recent work) as a slot: its lines once the page arrived, an error when the page or
 * this region could not be read, the words of that status and the reload. A region that failed in place does not fail the page.
 */
export const useProfileRegion = <T>(
    agentId: string,
    pick: (agent: AgentProfileView) => RegionView<T>,
): {
    readonly slot: DataSlot<ReadonlyArray<T>>
    readonly labels: (empty: string) => SlotLabels
    readonly reload: () => void
} => {
    const t = useTranslations("agentProfile")
    const { slot, reload } = useAgentProfile(agentId)
    const region = mapSlot(slot, pick)
    const items: DataSlot<ReadonlyArray<T>> =
        "items" in region && region.items.isFailed ? { isError: true } : mapSlot(region, (value) => value.items)
    return {
        slot: items,
        labels: (empty) => ({ empty, forbidden: t("regionFailed"), error: t("regionFailed"), retry: t("retry") }),
        reload,
    }
}
