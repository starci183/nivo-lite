import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState, useTransition } from "react"
import { PROVIDERS } from "@/hooks/connection-providers"
import { allAgentIds, useChannelReason, useFirstEvent, useLatest } from "@/hooks/connection-wizard"
import type { AgentOption, Environment, MoneyProvider, WizardConnection, WizardNote } from "@/modules/types"
import { connectionNameOf, MONEY_STEPS, moneyContextOf, moneyFlagsOf, webhookNameOf } from "./money-wizard.shared"
import type { AccountForm, FollowDraft, MoneyActions } from "./money-wizard.shared"

/** What the bank and payment wizard needs from its drawer. */
interface MoneyWizardInput {
    readonly provider: MoneyProvider
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    readonly actions: MoneyActions
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
    const reasonOf = useChannelReason()
    const def = PROVIDERS[input.provider]
    const [nav, setNav] = useState({ index: 0, skipped: false, resumed: false })
    const [form, setForm] = useState<AccountForm>({
        environment: def.environments[0],
        name: "",
        bank: "",
        account: "",
        holder: "",
    })
    const [conn, setConn] = useState<WizardConnection | null>(null)
    const [follow, setFollow] = useState<FollowDraft>({ webhookName: "", apiKey: "", values: {}, keysSaved: false })
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [note, setNote] = useState<WizardNote | null>(null)
    const [isPending, startTransition] = useTransition()
    const actions = useLatest(input.actions)
    const step = MONEY_STEPS[nav.index] ?? "env"
    const watch = useFirstEvent({
        connectionId: conn === null ? null : conn.id,
        isActive: step === "verify",
        check: input.actions.checkFirstEvent,
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
        setFollow((current) => ({ ...current, webhookName: webhookNameOf(stored.name), apiKey: stored.apiKey }))
    }, [])

    useEffect(() => {
        if (input.resumeId === undefined) return undefined
        const connectionId = input.resumeId
        let live = true
        startTransition(async () => {
            const answer = await actions.current.resume(connectionId)
            if (!live) return
            if (answer.kind === "ok") {
                adopt(answer.value)
                setFollow((current) => ({ ...current, keysSaved: answer.value.credentialsSaved }))
                if (answer.value.agentIds.length > 0) setAgentIds(answer.value.agentIds)
                setNav((current) => ({ ...current, index: 2, resumed: true }))
            } else {
                setNote({ tone: "negative", text: reasonOf(answer.fault.code) })
                setNav((current) => ({ ...current, resumed: true }))
            }
        })
        return () => {
            live = false
        }
    }, [input.resumeId, actions, adopt, reasonOf])

    const go = (to: number) => {
        setNote(null)
        setNav((current) => ({ ...current, index: to }))
    }
    const fail = (code: string) => setNote({ tone: "negative", text: reasonOf(code) })

    /** Saves edits to the existing connection, then moves on (and says what to change on the provider too). */
    const save = (name: string, to: number) => {
        if (conn === null) return
        startTransition(async () => {
            const answer = await input.actions.update(
                conn.id,
                { ...form, name },
                input.provider === "sepay" ? follow.apiKey : undefined,
            )
            if (answer.kind !== "ok") return fail(answer.fault.code)
            adopt(answer.value)
            go(to)
            setNote({ tone: "affirmative", text: tw("editSaved", { brand: def.brand }) })
        })
    }

    const create = () => {
        if (conn !== null) return flags.accountDirty ? save(form.name, 2) : go(2)
        startTransition(async () => {
            const answer = await input.actions.start(input.provider, form)
            if (answer.kind !== "ok") return fail(answer.fault.code)
            adopt(answer.value)
            go(2)
        })
    }

    const followDone = () => {
        if (conn === null) return
        if (flags.followDirty) return save(connectionNameOf(follow.webhookName), flags.needsKeys ? 2 : 3)
        if (flags.keysDone) return go(3)
        startTransition(async () => {
            const answer = await input.actions.saveKeys(conn.id, follow.values)
            if (answer.kind !== "ok") return fail(answer.fault.code)
            setFollow((current) => ({ ...current, keysSaved: true, values: {} }))
            if (!answer.value.confirmed && def.confirmsWebhook === true)
                setNote({ tone: "informative", text: tw("payosLocal") })
            else go(3)
        })
    }

    const finish = () => {
        if (conn === null) return input.onClose(false)
        startTransition(async () => {
            const answer = await input.actions.setAgents(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.fault.code)
            input.onClose(true)
        })
    }

    return {
        index: nav.index,
        step,
        isLoading: input.resumeId !== undefined && !nav.resumed,
        form,
        conn,
        follow,
        note,
        agentIds,
        isPending,
        received,
        firstEvent: watch.event ?? (conn === null ? null : conn.firstEvent),
        hasCheckFailed: watch.failed,
        hasSkipped: nav.skipped,
        flags,
        context: moneyContextOf(form, conn),
        on: {
            go,
            create,
            followDone,
            finish,
            skip: () => {
                setNote(null)
                setNav((current) => ({ ...current, index: 4, skipped: true }))
            },
            close: () => input.onClose(conn !== null),
            environment: (environment: Environment) => setForm((current) => ({ ...current, environment })),
            name: (name: string) => setForm((current) => ({ ...current, name })),
            bank: (bank: string) => setForm((current) => ({ ...current, bank })),
            account: (account: string) => setForm((current) => ({ ...current, account })),
            holder: (holder: string) => setForm((current) => ({ ...current, holder })),
            edit: (token: string, value: string) =>
                setFollow((current) =>
                    token === "webhookName" ? { ...current, webhookName: value } : { ...current, apiKey: value },
                ),
            paste: (field: string, value: string) =>
                setFollow((current) => ({ ...current, values: { ...current.values, [field]: value } })),
            agents: setAgentIds,
        },
    }
}
