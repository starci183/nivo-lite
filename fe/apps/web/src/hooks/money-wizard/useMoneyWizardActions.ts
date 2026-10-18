"use client"

import { useTransition } from "react"
import { connectionNameOf, type AccountForm, type FollowDraft, type MoneyFlags } from "./money-wizard.shared"
import { type ProviderDef } from "@/hooks/connection-providers"
import type { Settled } from "@/hooks/connection-wizard"
import { type AgentWish } from "@/hooks/connections"
import type { WizardConnection, WizardNote } from "@/modules/types"
import { useTranslations } from "next-intl"
import { type MoneyCommands } from "./useMoneyCommands"
import type { MoneyWizardInput } from "./useMoneyWizard"

/** Owns the pending transition and the commands that move the payment setup forward. */
export const useMoneyWizardActions = (input: MoneyWizardActionsInput) => {
    const [isPending, startTransition] = useTransition()
    const { save, go, fail } = createMoneyWizardActions({ ...input, startTransition })
    const { create, followDone, finish } = createMoneyWizardActions2({ ...input, save, go, fail, startTransition })
    return { go, create, followDone, finish, isPending }
}

/** The state and commands shared by the payment setup transitions. */
type MoneyWizardActionsInput = Omit<MoneyWizardSaveInput, "startTransition"> &
    Omit<MoneyWizardFinishInput, "startTransition" | "save" | "go" | "fail">

/** The resolved inputs for money wizard save input. */
interface MoneyWizardSaveInput {
    readonly setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>
    readonly setNav: import("react").Dispatch<import("react").SetStateAction<{ index: number; skipped: boolean }>>
    readonly conn: WizardConnection | null
    readonly startTransition: import("react").TransitionStartFunction
    readonly commands: MoneyCommands
    readonly form: AccountForm
    readonly input: MoneyWizardInput
    readonly follow: FollowDraft
    readonly adopt: (stored: WizardConnection) => void
    readonly tw: ReturnType<typeof useTranslations<"connectionWizard">>
    readonly def: ProviderDef
}

const createMoneyWizardActions = ({
    setNote,
    setNav,
    conn,
    startTransition,
    commands,
    form,
    input,
    follow,
    adopt,
    tw,
    def,
}: MoneyWizardSaveInput) => {
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

/** The resolved inputs for money wizard finish input. */
interface MoneyWizardFinishInput {
    readonly conn: WizardConnection | null
    readonly flags: MoneyFlags
    readonly save: (name: string, to: number) => void
    readonly form: AccountForm
    readonly go: (to: number) => void
    readonly startTransition: import("react").TransitionStartFunction
    readonly commands: MoneyCommands
    readonly input: MoneyWizardInput
    readonly fail: (message: string) => void
    readonly adopt: (stored: WizardConnection) => void
    readonly follow: FollowDraft
    readonly setFollow: import("react").Dispatch<import("react").SetStateAction<FollowDraft>>
    readonly def: ProviderDef
    readonly setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>
    readonly tw: ReturnType<typeof useTranslations<"connectionWizard">>
    readonly setAgentsOf: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>
    readonly agentIds: readonly string[]
}

const createMoneyWizardActions2 = ({
    conn,
    flags,
    save,
    form,
    go,
    startTransition,
    commands,
    input,
    fail,
    adopt,
    follow,
    setFollow,
    def,
    setNote,
    tw,
    setAgentsOf,
    agentIds,
}: MoneyWizardFinishInput) => {
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
