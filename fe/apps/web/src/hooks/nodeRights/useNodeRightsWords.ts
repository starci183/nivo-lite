"use client"

import { nodeCardsOf } from "@/modules/plugin-registry"
import { useLocale, useTranslations } from "next-intl"
import { isProvider, PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import type { NodeRightsWords } from "./nodeRights.shared"

/**
 * The shared vocabulary of the rights screens, resolved once (namespace `nodeRights`, the words every rights screen draws alike): the
 * chips, the provider names and logos of the connections catalogue, and the step labels of the step registry the canvas uses.
 */
export const useNodeRightsWords = (): NodeRightsWords => {
    const t = useTranslations("nodeRights")
    const tc = useTranslations("connections")
    const cards = nodeCardsOf(useLocale() === "en" ? "en" : "vi")
    return {
        kindRead: t("kindRead"),
        kindWrite: t("kindWrite"),
        effects: { money: t("effectMoney"), irreversible: t("effectIrreversible") },
        modeAuto: t("modeAuto"),
        modeAsk: t("modeAsk"),
        modeInline: { auto: t("modeAutoInline"), ask: t("modeAskInline") },
        stepsUsing: (count) => t("stepsUsing", { count }),
        noHolder: t("noHolder"),
        noStepCalls: t("noStepCalls"),
        notOpen: t("notOpen"),
        everyMember: t("everyMember"),
        roles: { decider: t("roleDecider"), notice: t("roleNotice") },
        providerNameOf: (provider) => {
            const key = isProvider(provider) ? providerKey(provider, "title") : ""
            return key !== "" && tc.has(key) ? tc(key) : provider
        },
        providerLogoOf: (provider) => (isProvider(provider) ? (PROVIDER_LOGO[provider] ?? null) : null),
        stepLabelOf: (step, nodeKey) => cards.get(step)?.title ?? nodeKey,
    }
}
