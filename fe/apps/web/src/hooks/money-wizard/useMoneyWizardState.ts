"use client"

import { useCallback, useState } from "react"
import { allAgentIds, useAdoptOnce } from "@/hooks/connection-wizard"
import { wizardConnectionOf } from "@/hooks/connection-wire"
import { useFirstEvent } from "@/hooks/connections"
import { useQueryMoneyConnectionSwr } from "@/hooks/swr"
import type { WizardConnection, WizardNote } from "@/modules/types"
import type { ProviderDef } from "@/hooks/connection-providers"
import { MONEY_STEPS, moneyFlagsOf, webhookNameOf } from "./money-wizard.shared"
import type { AccountForm, FollowDraft } from "./money-wizard.shared"
import type { MoneyWizardInput } from "./useMoneyWizard"

/** The draft after a stored connection is adopted; the key is in clear only when the server just created it, a masked one never replaces it. */
const followAfterAdopt = (current: FollowDraft, stored: WizardConnection): FollowDraft => ({
    ...current,
    webhookName: webhookNameOf(stored.name),
    ...(stored.apiKey.startsWith("•")
        ? { issuedKey: current.apiKey || current.issuedKey }
        : { apiKey: stored.apiKey, issuedKey: stored.apiKey }),
})

/** Owns the bank-connection draft, resumed state and first-event observation. */
export const useMoneyWizardState = (input: MoneyWizardInput, def: ProviderDef) => {
    const [nav, setNav] = useState({ index: 0, skipped: false })
    const [form, setForm] = useState<AccountForm>({
        environment: def.environments[0] ?? "live",
        name: "",
        bank: "",
        account: "",
        holder: "",
    })
    const [conn, setConn] = useState<WizardConnection | null>(null)
    const [follow, setFollow] = useState<FollowDraft>({
        webhookName: "",
        apiKey: "",
        issuedKey: "",
        values: {},
        keysSaved: false,
    })
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [note, setNote] = useState<WizardNote | null>(null)

    const resume = useQueryMoneyConnectionSwr(input.resumeId, { revalidateOnFocus: false, shouldRetryOnError: false })
    const step = MONEY_STEPS[nav.index] ?? "env"
    const watch = useFirstEvent({
        connectionId: conn === null ? null : conn.id,
        isActive: step === "verify",
    })
    const received = watch.event !== null || (conn !== null && conn.firstEvent !== null)
    const flags = moneyFlagsOf(def, form, follow, conn)

    /** Keeps the form and the follow-along drafts in step with the stored connection. */
    const adopt = useCallback((stored: WizardConnection) => {
        setConn(stored)
        setForm({
            environment: stored.environment,
            name: stored.name,
            bank: stored.bankCode,
            account: "",
            holder: stored.holder,
        })
        setFollow((current) => followAfterAdopt(current, stored))
    }, [])

    // The stored connection arrives once: adopt it while rendering (derived state), not from an effect.
    useAdoptOnce(resume.data, (data) => {
        const stored = wizardConnectionOf(data)
        adopt(stored)
        setFollow((current) => ({ ...current, keysSaved: stored.credentialsSaved }))
        if (stored.agentIds.length > 0) setAgentIds(stored.agentIds)
        setNav((current) => ({ ...current, index: 2 }))
    })

    return {
        nav,
        setNav,
        form,
        setForm,
        conn,
        follow,
        setFollow,
        agentIds,
        setAgentIds,
        note,
        setNote,
        resume,
        step,
        watch,
        received,
        flags,
        adopt,
    }
}
