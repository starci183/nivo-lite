import { useTranslations } from "next-intl"
import { useCallback, useState, useTransition } from "react"
import { PROVIDERS } from "@/hooks/connection-providers"
import { allAgentIds } from "@/hooks/connection-wizard"
import { wizardConnectionOf } from "@/hooks/connection-wire"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryMoneyConnectionSwr } from "@/hooks/swr/api/graphql/queries/useQueryMoneyConnectionSwr"
import type { AgentOption, Environment, MoneyProvider, WizardConnection, WizardNote } from "@/modules/types"
import { connectionNameOf, MONEY_STEPS, moneyContextOf, moneyFlagsOf, webhookNameOf } from "./money-wizard.shared"
import type { AccountForm, FollowDraft } from "./money-wizard.shared"
import { useMoneyCommands } from "./useMoneyCommands"

/** What the bank and payment wizard needs from its drawer. */
interface MoneyWizardInput {
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
    const [nav, setNav] = useState({ index: 0, skipped: false })
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
        setFollow((current) => ({ ...current, webhookName: webhookNameOf(stored.name), apiKey: stored.apiKey }))
    }, [])

    const resumeFailure = resume.error instanceof Error ? resume.error.message : undefined
    const [adopted, setAdopted] = useState<typeof resume.data>(undefined)

    // The stored connection arrives once: adopt it while rendering (derived state), not from an effect.
    if (resume.data !== undefined && resume.data !== adopted) {
        const stored = wizardConnectionOf(resume.data)
        setAdopted(resume.data)
        adopt(stored)
        setFollow((current) => ({ ...current, keysSaved: stored.credentialsSaved }))
        if (stored.agentIds.length > 0) setAgentIds(stored.agentIds)
        setNav((current) => ({ ...current, index: 2 }))
    }

    const go = (to: number) => {
        setNote(null)
        setNav((current) => ({ ...current, index: to }))
    }
    const fail = (message: string) => setNote({ tone: "negative", text: message })

    /** Saves edits to the existing connection, then moves on (and says what to change on the provider too). */
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

    return {
        index: nav.index,
        step,
        isLoading: input.resumeId !== undefined && resume.data === undefined && resume.error === undefined,
        form,
        conn,
        follow,
        note: note ?? (resumeFailure === undefined ? null : ({ tone: "negative", text: resumeFailure } as const)),
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
