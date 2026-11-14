"use client"

import { useTranslations } from "next-intl"
import { useNodeRightsCopy, useNodeRightsWords, useProviderRightHolders } from "@/hooks/nodeRights"
import { useSlotLabels } from "@/hooks/slot"
import { ProviderRightsTabBase } from "./component"

/** The Rights tab of a connected account's page: who holds each right of this provider, down to the step (read-only). */
export const ProviderRightsTab = () => {
    const t = useTranslations("providerPage")
    const copy = useNodeRightsCopy()
    const words = useNodeRightsWords()
    const slotLabels = useSlotLabels()
    const read = useProviderRightHolders()
    return (
        <ProviderRightsTabBase
            props={{
                slot: read.slot,
                slotLabels: slotLabels(t("rightsToolsEmpty")),
                words: {
                    agentsLabel: t("rightsAgents"),
                    screensLabel: t("rightsScreens"),
                    triggersLabel: t("rightsTriggers"),
                    agentsHint: copy.provider.agentsHint,
                    screensHint: copy.provider.screensHint,
                    screensLater: t("rightsScreensLater"),
                    filterLabel: t("rightsFilterLabel"),
                    filterAll: copy.provider.filterAll,
                    filterHeld: copy.provider.filterHeld,
                    filterUnheld: copy.provider.filterUnheld,
                    filterWrites: copy.provider.filterWrites,
                    columnRight: t("rightsColumnRight"),
                    columnKind: t("rightsColumnKind"),
                    columnHolders: t("rightsColumnHolders"),
                    columnTrigger: t("rightsColumnTrigger"),
                    columnReceivers: t("rightsColumnReceivers"),
                    kindRead: words.kindRead,
                    kindWrite: words.kindWrite,
                    modeAuto: words.modeInline.auto,
                    modeAsk: words.modeInline.ask,
                    noHolder: words.noHolder,
                    notOpen: words.notOpen,
                    toolsEmpty: t("rightsToolsEmpty"),
                    toolsFilteredEmpty: t("rightsToolsFilteredEmpty"),
                    screensEmpty: t("rightsScreensEmpty"),
                    triggersEmpty: t("rightsTriggersEmpty"),
                    moreRights: copy.provider.moreRights,
                    more: copy.common.more,
                    holderMore: (count) => t("rightsHolderMore", { count }),
                },
            }}
            on={{ retry: read.retry }}
        />
    )
}
