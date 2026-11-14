"use client"

import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryAgentDeletionImpactSwr } from "@/hooks/swr"
import { removalLinesOf, removeTypeKeyOf } from "@/modules/agentRemoval"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the removal dialog of one agent says: its sentences as a slot (loading, failed, ready), the words of the slot and the way to ask again. */
export interface AgentRemovalImpactView {
    readonly lines: DataSlot<ReadonlyArray<string>>
    readonly labels: SlotLabels
    readonly retry: () => void
}

/**
 * Reads what removing an agent erases while its confirmation is open (`installationId` null: closed, nothing is read) and words it: the
 * records per type with their counts, the files, that it cannot be undone; the plain confirmation when the agent wrote nothing.
 */
export const useAgentRemovalImpact = (installationId: string | null): AgentRemovalImpactView => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const read = useQueryAgentDeletionImpactSwr(installationId ?? undefined)
    const slot = slotOfSwr({
        data: read.data,
        error: read.error,
        isLoading: read.isLoading,
        isValidating: read.isValidating,
    })
    return {
        lines: mapSlot(slot, (impact) =>
            removalLinesOf(
                {
                    records: impact.records,
                    files: impact.files,
                    types: impact.recordTypes.map((entry) => ({ type: entry.type, title: entry.title, count: entry.count })),
                    // Awaiting the back end field `AgentDeletionImpactType.channels` (exec/N-2-for-TOOLS-LEAD.md): once the query document selects it,
                    // add the property `channels: impact.channels.map((c) => ({ provider: c.providerName, account: c.accountName }))`.
                },
                {
                    stops: t("removeBody1"),
                    kept: t("removeBody2"),
                    keptWithErase: t("removeKeptWithErase"),
                    erased: t("removeErased"),
                    erasedType: (title, count) => t("removeErasedType", { title, count }),
                    files: (count) => t("removeFiles", { count }),
                    channelsIntro: t("removeChannelsIntro"),
                    channelLine: (provider, account) => t("removeChannelLine", { provider, account }),
                    channelsNote: t("removeChannelsNote"),
                    undone: t("removeUndone"),
                    accounts: t("removeBody3"),
                    typeLabel: (type) => {
                        const key = removeTypeKeyOf(type)
                        return t.has(key) ? t(key) : null
                    },
                },
            ),
        ),
        labels: { ...slotLabels(t("removeBody1")), error: t("removeImpactFailed") },
        retry: () => void read.mutate(),
    }
}
