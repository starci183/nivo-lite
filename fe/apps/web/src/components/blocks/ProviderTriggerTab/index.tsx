"use client"

import { useTranslations } from "next-intl"
import { useProviderDocLevel } from "@/hooks/providerOffer"
import { useProviderTriggerCard } from "@/hooks/providerTriggers"
import { useSlotLabels } from "@/hooks/slot"
import { ProviderTriggerTabBase } from "./component"

/**
 * The Trigger tab of a connected account's page: the switch of each trigger the provider declares with its last fire and the
 * workflows it wakes (every change goes through the back end), then the events documented from the registry through `providerOffer`.
 */
export const ProviderTriggerTab = () => {
    const t = useTranslations("providerPage")
    const slotLabels = useSlotLabels()
    const read = useProviderDocLevel("trigger")
    const card = useProviderTriggerCard()
    return (
        <ProviderTriggerTabBase
            props={{
                level: read.level,
                words: read.words,
                slotLabels: slotLabels(read.level.empty),
                card: {
                    words: {
                        title: t("triggerCardTitle"),
                        switchLabel: (trigger) => t("triggerSwitchLabel", { trigger }),
                        workflowsTitle: t("triggerWorkflowsTitle"),
                        workflowsNone: t("triggerWorkflowsNone"),
                        catchUpTitle: t("triggerCatchUpTitle"),
                        catchUpHint: t("triggerCatchUpHint"),
                        deciderTitle: t("triggerDeciderTitle"),
                        deciderHint: t("triggerDeciderHint"),
                        deciderLabel: (trigger) => t("triggerDeciderLabel", { trigger }),
                        deciderNone: t("triggerDeciderNone"),
                        deciderPlaceholder: t("triggerDeciderPlaceholder"),
                        empty: t("triggerCardEmpty"),
                    },
                    slot: card.slot,
                    placeholder: card.placeholder,
                    slotLabels: slotLabels(t("triggerCardEmpty")),
                    canEdit: card.canEdit,
                    isBusy: card.isBusy,
                    error: card.error,
                    on: { ...card.on, retry: card.retry },
                },
            }}
            on={{ retry: read.retry }}
        />
    )
}
