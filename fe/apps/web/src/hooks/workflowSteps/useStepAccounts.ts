"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useAgentNodeRights, useNodeRightsCopy } from "@/hooks/nodeRights"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import type { StepAccountsWords } from "@/modules/workflowSteps"
import type { AgentRightAccountView, DataSlot } from "@/modules/types"

/** The accounts the agent of this installation is attached to, with what each offers, and the words the panel and the chips use. */
export interface StepAccounts {
    /** The agent's attached accounts; undefined while the read is in flight or when it failed. */
    readonly attached: ReadonlyArray<AgentRightAccountView> | undefined
    /** The read as a slot, for the panel's loading / error shape. */
    readonly slot: DataSlot<ReadonlyArray<AgentRightAccountView>>
    readonly retry: () => void
    readonly words: StepAccountsWords
    readonly emptyLabel: string
    readonly slotLabels: ReturnType<ReturnType<typeof useSlotLabels>>
    /** True when an agent is known to choose accounts among (the installation was found). */
    readonly isKnown: boolean
}

/** The choices of the step panel (`agentNodeRights.accounts`) for the agent that runs this installation, with the panel's words. */
export const useStepAccounts = (installationId: string): StepAccounts => {
    const t = useTranslations("nodeRights")
    const copy = useNodeRightsCopy()
    const slotLabelsOf = useSlotLabels()
    const installations = useQueryModuleInstallationsSwr().data
    const agentId = installations?.find((one) => one.id === installationId)?.agentId ?? null
    const rights = useAgentNodeRights(agentId)
    const { slot } = rights
    const words = useMemo<StepAccountsWords>(
        () => ({
            sectionTitle: t("panelSection"),
            sectionHint: copy.panel.subtitle,
            noProvider: t("panelNoProvider"),
            addLabel: copy.panel.addProvider,
            addHint: copy.panel.addHint,
            removeLabel: copy.panel.remove,
            modeAuto: t("modeAuto"),
            modeAsk: t("modeAsk"),
            modeMissing: t("modeMissing"),
            modeNone: t("chipNoMode"),
            notAttachedLine: copy.common.notAttached,
            effectiveTitle: copy.panel.effectiveTitle,
            effectiveHint: copy.panel.effectiveHint,
            notAttached: copy.panel.effectiveNotAttached,
            chipProvider: (account) => t("chipProvider", { account }),
            chipMessaging: (account) => t("chipMessaging", { account }),
        }),
        [t, copy],
    )
    const attached = "items" in slot ? slot.items.accounts : undefined
    return {
        attached,
        slot: mapSlot(slot, (view) => view.accounts),
        retry: rights.retry,
        words,
        emptyLabel: copy.panel.subtitle,
        slotLabels: slotLabelsOf(copy.panel.subtitle),
        isKnown: agentId !== null,
    }
}
