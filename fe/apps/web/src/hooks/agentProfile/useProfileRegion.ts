"use client"

import { useTranslations } from "next-intl"
import type { AgentProfileView, RegionView } from "./agentProfile.shared"
import { useAgentProfile } from "./useAgentProfile"

/**
 * One region of the profile page (rules, tags, recent work): its lines, the state every region shares (loading, failed, the words of
 * the failure) and the reload. A region that failed in place does not fail the page.
 */
export const useProfileRegion = <T>(agentId: string, pick: (agent: AgentProfileView) => RegionView<T>) => {
    const t = useTranslations("agentProfile")
    const { slot, reload } = useAgentProfile(agentId)
    const region = slot.items === undefined ? null : pick(slot.items)
    return {
        items: region?.items ?? [],
        reload,
        frame: {
            isLoading: slot.items === undefined && slot.isError !== true,
            isFailed: slot.isError === true || region?.isFailed === true,
            failure: { title: t("regionFailed"), description: t("regionFailedText"), retryLabel: t("retry") },
        },
    }
}
