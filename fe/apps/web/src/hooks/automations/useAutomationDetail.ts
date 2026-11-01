"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_AUTOMATIONS_SWR_KEY, useMutateProposeAutomationBodySwr, useMutateRunAutomationNowSwr } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import type { AutomationValues } from "@/modules/automations"
import type { AutomationCardView, ConfigValue } from "@/modules/types"

/** How the proposal came out: written by the model, or the standard wording. */
type ProposalNote = "proposal" | "fallback"

/** What the open card edits: its settings and its wording. */
interface DetailForm {
    readonly key: string | null
    readonly values: AutomationValues
    readonly body: string
    readonly note: ProposalNote | null
    readonly isSaved: boolean
}

/** What the back end is doing for the open card. */
interface DetailWork {
    readonly isComposing: boolean
    readonly isStarting: boolean
    readonly isStarted: boolean
}

/** Everything the detail of the open card edits, and the commands it asks of the back end. */
export interface AutomationDetailState {
    readonly form: DetailForm
    readonly work: DetailWork
    readonly changeValue: (key: string, value: ConfigValue) => void
    readonly markSaved: (saved: boolean) => void
    readonly editBody: (value: string) => void
    /** Asks for the proposal of the open card, or of the card named. */
    readonly compose: (forKey?: string) => void
    readonly startRun: () => void
}

const formOf = (card: AutomationCardView | null): DetailForm => ({
    key: card?.key ?? null,
    values: { ...card?.config },
    body: card?.body ?? "",
    note: null,
    isSaved: false,
})

const IDLE: DetailWork = { isComposing: false, isStarting: false, isStarted: false }

/**
 * The local state of the detail of the open card. It starts over when another card opens. The proposal is one synchronous
 * mutation; the run is queued by a mutation and lands in the run history, which the overview query polls until it settles.
 * Every outcome is toasted.
 */
export const useAutomationDetail = (card: AutomationCardView | null): AutomationDetailState => {
    const t = useTranslations("automations")
    const runGraphQL = useGraphQLWithToast()
    const propose = useMutateProposeAutomationBodySwr()
    const runNow = useMutateRunAutomationNowSwr()
    const key = card?.key ?? null
    const [form, setForm] = useState<DetailForm>(() => formOf(card))
    const [work, setWork] = useState<DetailWork>(IDLE)

    if (key !== form.key) {
        setForm(formOf(card))
        setWork(IDLE)
    }

    const compose = useCallback(
        (forKey?: string) => {
            const target = forKey ?? key
            if (target === null) return
            setWork((previous) => ({ ...previous, isComposing: true }))
            void runGraphQL(() => propose.trigger({ templateKey: target }), { showSuccessToast: false }).then(
                (proposal) => {
                    setWork((previous) => ({ ...previous, isComposing: false }))
                    if (proposal === undefined) return
                    setForm((previous) => ({
                        ...previous,
                        body: proposal.body,
                        note: proposal.generated ? "proposal" : "fallback",
                    }))
                    toast.success(t("messageTitle"), {
                        description: t(proposal.generated ? "proposalNote" : "fallbackNote"),
                    })
                },
            )
        },
        [runGraphQL, propose, key, t],
    )

    const startRun = useCallback(() => {
        if (key === null) return
        setWork((previous) => ({ ...previous, isStarting: true, isStarted: false }))
        void runGraphQL(() => runNow.trigger({ templateKey: key }), { successMessage: t("runNowStarted") }).then(
            (queued) => {
                setWork((previous) => ({ ...previous, isStarting: false, isStarted: queued === true }))
                if (queued === true) void mutate(matchesSwrKey(QUERY_AUTOMATIONS_SWR_KEY))
            },
        )
    }, [runGraphQL, runNow, key, t])

    return {
        form,
        work,
        changeValue: (name, value) =>
            setForm((previous) => ({ ...previous, isSaved: false, values: { ...previous.values, [name]: value } })),
        markSaved: (saved) => setForm((previous) => ({ ...previous, isSaved: saved })),
        editBody: (value) => setForm((previous) => ({ ...previous, body: value, note: null })),
        compose,
        startRun,
    }
}
