"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { PROVIDER_LOGO, isProvider } from "@/hooks/connection-providers"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentConnectionsSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
import type { DataSlot } from "@/modules/types"

/** One thing the agent answers from: a connection granted to it. */
export interface AgentChatSource {
    readonly id: string
    readonly label: string
    /** The purpose and the level of the grant, in words. */
    readonly subline: string
    /** The provider mark, or undefined when the app holds none. */
    readonly logo: string | undefined
}

/** The connections the agent answers from, in words; Second Brain is drawn beside them by the rail. */
export const useAgentChatSources = (agentId: string | null): DataSlot<ReadonlyArray<AgentChatSource>> => {
    const t = useTranslations("agentConnections")
    const read = useQueryAgentConnectionsSwr(agentId === null ? null : { agentId })
    const { data } = read
    const purposes: Readonly<Record<string, string>> = {
        inbound_chat: t("purposeInboundChat"),
        outbound_chat: t("purposeOutboundChat"),
        bank_feed: t("purposeBankFeed"),
        data_source: t("purposeDataSource"),
        tool: t("purposeTool"),
        lead_source: t("purposeLeadSource"),
    }
    const levels: Readonly<Record<string, string>> = { read: t("levelRead"), ask: t("levelAsk"), auto: t("levelAuto") }
    const sources = useMemo(
        () =>
            data?.map((grant): AgentChatSource => ({
                id: `${grant.id}:${grant.purpose}`,
                label: grant.name,
                subline: [purposes[grant.purpose], levels[grant.access]]
                    .filter((part) => part !== undefined)
                    .join(" · "),
                logo: isProvider(grant.provider) ? PROVIDER_LOGO[grant.provider] : undefined,
            })),
        [data, purposes, levels],
    )
    return slotOfSwr({ data: sources, error: readError(read), isLoading: read.isLoading || agentId === null })
}
