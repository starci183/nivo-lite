"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { useSettledGraphQL, type Settled } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { useProviderRightHolders } from "@/hooks/nodeRights"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import {
    useMutateBindProviderTriggerDeciderSwr,
    useMutateSetProviderTriggerEnabledSwr,
    useQueryProviderTriggerStatesSwr,
} from "@/hooks/swr"
import type { DataSlot, ProviderTriggerCardView } from "@/modules/types"
import {
    PROVIDER_TRIGGER_CARD_PLACEHOLDER,
    PROVIDER_TRIGGER_ERROR_KEYS,
    kindWordOf,
    triggerCardOf,
    workflowsOfTrigger,
    type ProviderTriggerState,
} from "./providerTriggers.shared"

/** What the Trigger card draws and does. */
export interface ProviderTriggerCardRead {
    readonly slot: DataSlot<ProviderTriggerCardView>
    readonly placeholder: ProviderTriggerCardView
    /** Owner or manager may change a switch; anyone else sees the card read-only. */
    readonly canEdit: boolean
    /** A change is on its way: the controls wait. */
    readonly isBusy: boolean
    /** The words of the last refusal, in the reader's language; null when the last change went through. */
    readonly error: string | null
    readonly retry: () => void
    readonly on: {
        readonly toggle: (trigger: string, isOn: boolean) => void
        readonly catchUp: (isOn: boolean) => void
        readonly bind: (trigger: string, agentId: string | null) => void
    }
}

/**
 * The Trigger card of the Cau hinh tab for the account the address names: the `providerTriggerStates` read, the switch and the
 * decider mutations; each answer is the trigger's new row and replaces that row in the cache. A refusal is worded from its
 * `extensions.code`.
 */
export const useProviderTriggerCard = (): ProviderTriggerCardRead => {
    const t = useTranslations("providerPage")
    const locale = useLocale()
    const format = useFormatter()
    const params = useParams<{ id?: string }>()
    const connectionId = typeof params.id === "string" ? params.id : null
    const read = useQueryProviderTriggerStatesSwr(connectionId)
    const role = useConnectionsRole().role
    const settle = useSettledGraphQL()
    const setEnabled = useMutateSetProviderTriggerEnabledSwr()
    const bindDecider = useMutateBindProviderTriggerDeciderSwr()
    const holders = useProviderRightHolders().slot
    const [catchUp, setCatchUp] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { mutate } = read

    const words = useMemo(
        () => ({
            locale,
            fired: (when: string, count: number) => t("triggerFired", { when, count }),
            when: (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }),
            kind: (kind: string) => kindWordOf(kind, { webhook: t("kindWebhook"), poll: t("kindPoll") }),
            neverFired: t("triggerNeverFired"),
        }),
        [locale, format, t],
    )

    const settled = useCallback(
        async (action: () => Promise<ProviderTriggerState>): Promise<void> => {
            setError(null)
            const outcome: Settled<ProviderTriggerState> = await settle(action)
            if (outcome.kind === "ok") {
                const row = outcome.value
                await mutate((rows) => (rows ?? []).map((current) => (current.name === row.name ? row : current)), {
                    revalidate: false,
                })
                return
            }
            const key = outcome.code === undefined ? undefined : PROVIDER_TRIGGER_ERROR_KEYS[outcome.code]
            setError(key === undefined ? outcome.message : t(key))
        },
        [settle, mutate, t],
    )

    const workflowsOf = useCallback((trigger: string) => workflowsOfTrigger(holders, trigger), [holders])

    const toggle = useCallback(
        (trigger: string, isOn: boolean): void => {
            if (connectionId === null) return
            const can = (read.data ?? []).find((row) => row.name === trigger)?.canCatchUp === true
            void settled(() =>
                setEnabled.trigger({ connectionId, trigger, enabled: isOn, catchUp: isOn && can && catchUp }),
            )
        },
        [connectionId, read.data, settled, setEnabled, catchUp],
    )

    const bind = useCallback(
        (trigger: string, agentId: string | null): void => {
            if (connectionId === null) return
            void settled(() => bindDecider.trigger({ connectionId, trigger, agentId }))
        },
        [connectionId, settled, bindDecider],
    )

    return {
        slot: mapSlot(slotOfSwr(read), (states) => triggerCardOf(states, catchUp, words, workflowsOf)),
        placeholder: PROVIDER_TRIGGER_CARD_PLACEHOLDER,
        canEdit: role === "owner" || role === "manager",
        isBusy: setEnabled.isMutating || bindDecider.isMutating,
        error,
        retry: () => void read.mutate(),
        on: { toggle, catchUp: setCatchUp, bind },
    }
}
