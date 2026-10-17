"use client"

import { useTransition } from "react"
import { viewOf, connectionNameOf } from "./money-wizard.shared"
import type { AccountForm, FollowDraft, MoneyFlags } from "./money-wizard.shared"
import { PROVIDERS } from "@/hooks/connection-providers"
import type { ProviderDef } from "@/hooks/connection-providers"
import type { Settled } from "@/hooks/connection-wizard"
import { useSetConnectionAgents } from "@/hooks/connections"
import type { AgentWish } from "@/hooks/connections"
import type { AgentOption, MoneyProvider, WizardConnection, WizardNote } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useMoneyCommands } from "./useMoneyCommands"
import type { MoneyCommands } from "./useMoneyCommands"
import { useMoneyWizardState } from "./useMoneyWizardState"

/** What the bank and payment wizard needs from its drawer. */
export interface MoneyWizardInput {
    readonly provider: MoneyProvider
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The state machine of the guided setup for a bank or payment provider (SePay, payOS, Casso): environment, name and account,
 * "follow along on the provider", the wait for the first real webhook, attach to the agents. The connection is created (pending) when
 * the account step ends, so the URL and key exist for the follow-along step. Everything stays editable afterwards: the earlier steps
 * save on Next, and the follow-along step edits the webhook name and the SePay API key in place.
 */
export const useMoneyWizard = (input: MoneyWizardInput) => {
    const tw = useTranslations("connectionWizard")
    const commands = useMoneyCommands()
    const setAgentsOf = useSetConnectionAgents()
    const def = PROVIDERS[input.provider]
    const state = useMoneyWizardState(input, def)
    const [isPending, startTransition] = useTransition()
    const { save, go, fail } = createMoneyWizardActions(
        state.setNote,
        state.setNav,
        state.conn,
        startTransition,
        commands,
        state.form,
        input,
        state.follow,
        state.adopt,
        tw,
        def,
    )

    const { create, followDone, finish } = createMoneyWizardActions2(
        state.conn,
        state.flags,
        save,
        state.form,
        go,
        startTransition,
        commands,
        input,
        fail,
        state.adopt,
        state.follow,
        state.setFollow,
        def,
        state.setNote,
        tw,
        setAgentsOf,
        state.agentIds,
    )

    return viewOf(
        state.nav,
        state.step,
        input,
        state.resume,
        state.form,
        state.conn,
        state.follow,
        state.note,
        state.agentIds,
        isPending,
        state.received,
        state.watch,
        state.flags,
        go,
        create,
        followDone,
        finish,
        state.setNote,
        state.setNav,
        state.setForm,
        state.setFollow,
        state.setAgentIds,
    )
}

const createMoneyWizardActions = (
    setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>,
    setNav: import("react").Dispatch<import("react").SetStateAction<{ index: number; skipped: boolean }>>,
    conn: WizardConnection | null,
    startTransition: import("react").TransitionStartFunction,
    commands: MoneyCommands,
    form: AccountForm,
    input: MoneyWizardInput,
    follow: FollowDraft,
    adopt: (stored: WizardConnection) => void,
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
    def: ProviderDef,
) => {
    const go = (to: number) => {
        setNote(null)
        setNav((current) => ({ ...current, index: to }))
    }
    const fail = (message: string) => setNote({ tone: "negative", text: message })

    const save = (name: string, to: number) => {
        if (conn === null) return
        startTransition(async () => {
            const answer = await commands.update(
                conn.id,
                { ...form, name },
                input.provider === "sepay" ? follow.apiKey : undefined,
            )
            if (answer.kind !== "ok") return fail(answer.message)
            adopt(answer.value)
            go(to)
            setNote({ tone: "affirmative", text: tw("editSaved", { brand: def.brand }) })
        })
    }
    return { save, go, fail }
}

const createMoneyWizardActions2 = (
    conn: WizardConnection | null,
    flags: MoneyFlags,
    save: (name: string, to: number) => void,
    form: AccountForm,
    go: (to: number) => void,
    startTransition: import("react").TransitionStartFunction,
    commands: MoneyCommands,
    input: MoneyWizardInput,
    fail: (message: string) => void,
    adopt: (stored: WizardConnection) => void,
    follow: FollowDraft,
    setFollow: import("react").Dispatch<import("react").SetStateAction<FollowDraft>>,
    def: ProviderDef,
    setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>,
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
    setAgentsOf: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>,
    agentIds: readonly string[],
) => {
    const create = () => {
        if (conn !== null) return flags.accountDirty ? save(form.name, 2) : go(2)
        startTransition(async () => {
            const answer = await commands.start(input.provider, form)
            if (answer.kind !== "ok") return fail(answer.message)
            adopt(answer.value)
            go(2)
        })
    }

    const followDone = () => {
        if (conn === null) return
        if (flags.followDirty) return save(connectionNameOf(follow.webhookName), flags.needsKeys ? 2 : 3)
        if (flags.keysDone) return go(3)
        startTransition(async () => {
            const answer = await commands.saveKeys(conn.id, follow.values)
            if (answer.kind !== "ok") return fail(answer.message)
            setFollow((current) => ({ ...current, keysSaved: true, values: {} }))
            if (!answer.value.confirmed && def.confirmsWebhook === true)
                setNote({ tone: "informative", text: tw("payosLocal") })
            else go(3)
        })
    }

    const finish = () => {
        if (conn === null) return input.onClose(false)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            input.onClose(true)
        })
    }
    return { create, followDone, finish }
}

/** The current money-connection step and whether verification was skipped. */
export type NavInput1 = { index: number; skipped: boolean }
