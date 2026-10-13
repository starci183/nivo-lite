"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "swr"
import {
    QUERY_AUTOMATIONS_SWR_KEY,
    useQueryAutomationsSwr,
    useMutateUpdateAutomationPipelineSwr,
    useQueryAutomationGoogleAccountsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AutomationsOverviewView } from "@/modules/automations"
import type { AutomationPatch, AutomationsData } from "./automations.shared"

/** The toast text of a saved change: the switch said on or off, or just saved. */
const successTextOf = (patch: AutomationPatch, t: (key: string) => string): string => {
    if (patch.enabled === true) return t("toastOn")
    return patch.enabled === false ? t("toastOff") : t("saved")
}

/** The board data and the one change at a time the owner makes on a card. */
interface Automations {
    /** The gallery, the history, the shop, the sample and the accounts; absent while loading. */
    readonly data: AutomationsData | undefined
    readonly isLoading: boolean
    readonly error: unknown
    readonly busyKey: string | null
    /** Writes a patch to one pipeline; true when it worked (the outcome is toasted). */
    readonly apply: (key: string, patch: AutomationPatch) => Promise<boolean>
}

/**
 * The automations of the active workspace from the back end through SWR, and the `updateAutomationPipeline` mutation with
 * toasts and cache revalidation. The changed card replaces its old self in the cache before the revalidation answers.
 */
export const useAutomations = (): Automations => {
    const t = useTranslations("automations")
    const runGraphQL = useGraphQLWithToast()
    const overview = useQueryAutomationsSwr()
    const accounts = useQueryAutomationGoogleAccountsSwr()
    const { trigger } = useMutateUpdateAutomationPipelineSwr()
    const [busyKey, setBusyKey] = useState<string | null>(null)

    const apply = useCallback(
        async (key: string, patch: AutomationPatch): Promise<boolean> => {
            setBusyKey(key)
            const card = await runGraphQL(() => trigger({ templateKey: key, ...patch }), {
                successMessage: successTextOf(patch, t),
            })
            setBusyKey(null)
            if (card === undefined) return false
            await mutate<AutomationsOverviewView | undefined>(
                QUERY_AUTOMATIONS_SWR_KEY,
                (current) =>
                    current === undefined
                        ? current
                        : { ...current, cards: current.cards.map((item) => (item.key === key ? card : item)) },
                { revalidate: true },
            )
            return true
        },
        [runGraphQL, trigger, t],
    )

    const data =
        overview.data === undefined || accounts.data === undefined
            ? undefined
            : { ...overview.data, accounts: accounts.data }

    return {
        data,
        isLoading: overview.isLoading || accounts.isLoading,
        error: overview.error ?? accounts.error,
        busyKey,
        apply,
    }
}
