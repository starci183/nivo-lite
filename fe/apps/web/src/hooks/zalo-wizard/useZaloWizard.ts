import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { allAgentIds } from "@/hooks/connection-wizard"
import { zaloWizardOf } from "@/hooks/connection-wire"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryZaloConnectionSwr } from "@/hooks/swr/api/graphql/queries/useQueryZaloConnectionSwr"
import type { AgentOption, WizardNote, ZaloWizardConnection } from "@/modules/types"
import { canSaveOaSecret, ZALO_STEPS, zaloFailureOf, zaloStartStepOf } from "./zalo-wizard.shared"
import type { ZaloFields } from "./zalo-wizard.shared"
import { useZaloCommands } from "./useZaloCommands"

/** What the Zalo wizard needs from its drawer. */
interface ZaloWizardInput {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** How the Zalo sign-in ended when the browser came back: ok, denied, failed or expired. */
    readonly returned: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The Zalo wizard's state machine, like the bank one: name and app keys, set up the Zalo app (the OA Secret Key to paste), connect the
 * Official Account (the browser leaves for Zalo and comes back here), check (message the OA), attach to the agents.
 */
export const useZaloWizard = (input: ZaloWizardInput) => {
    const tw = useTranslations("connectionWizard")
    const commands = useZaloCommands()
    const setAgentsOf = useSetConnectionAgents()
    const [index, setIndex] = useState(0)
    const [fields, setFields] = useState<ZaloFields>({ name: "", appId: "", appSecret: "", oaSecret: "" })
    const [conn, setConn] = useState<ZaloWizardConnection | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [note, setNote] = useState<WizardNote | null>(null)
    const [isPending, startTransition] = useTransition()
    const resume = useQueryZaloConnectionSwr(input.resumeId, { revalidateOnFocus: false, shouldRetryOnError: false })
    const step = ZALO_STEPS[index] ?? "app"
    const watch = useFirstEvent({ connectionId: conn === null ? null : conn.id, isActive: step === "verify" })
    const firstEvent = watch.event ?? (conn === null ? null : conn.firstEvent)
    const resumeFailure = resume.error instanceof Error ? resume.error.message : undefined
    const [adopted, setAdopted] = useState<typeof resume.data>(undefined)

    // The stored connection arrives once: adopt it while rendering (derived state), not from an effect.
    if (resume.data !== undefined && resume.data !== adopted) {
        const stored = zaloWizardOf(resume.data)
        const failure = zaloFailureOf(input.returned, tw)
        setAdopted(resume.data)
        setConn(stored)
        if (stored.agentIds.length > 0) setAgentIds(stored.agentIds)
        if (failure !== null) setNote({ tone: "negative", text: failure })
        setIndex(zaloStartStepOf(stored, failure !== null))
    }

    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }
    const fail = (message: string) => setNote({ tone: "negative", text: message })

    const create = () => {
        if (conn !== null) return go(1)
        startTransition(async () => {
            const answer = await commands.start(fields)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            go(1)
        })
    }

    const saveSecret = () => {
        if (conn === null) return
        if (conn.oaSecretSaved && fields.oaSecret.trim() === "") return go(2)
        startTransition(async () => {
            const answer = await commands.saveOaSecret(conn.id, fields.oaSecret)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            setFields((current) => ({ ...current, oaSecret: "" }))
            go(2)
        })
    }

    const authorize = () => {
        if (conn === null) return
        startTransition(async () => {
            const answer = await commands.authorize(conn.id)
            if (answer.kind !== "ok") return fail(answer.message)
            window.location.assign(answer.value)
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
        index,
        step,
        fields,
        conn,
        note: note ?? (resumeFailure === undefined ? null : ({ tone: "negative", text: resumeFailure } as const)),
        isPending,
        isLoading: input.resumeId !== undefined && resume.data === undefined && resume.error === undefined,
        firstEvent,
        agentIds,
        canSaveSecret: canSaveOaSecret(conn, fields),
        on: {
            go,
            create,
            saveSecret,
            authorize,
            finish,
            close: () => input.onClose(conn !== null),
            name: (name: string) => setFields((current) => ({ ...current, name })),
            appId: (appId: string) => setFields((current) => ({ ...current, appId })),
            appSecret: (appSecret: string) => setFields((current) => ({ ...current, appSecret })),
            oaSecret: (oaSecret: string) => setFields((current) => ({ ...current, oaSecret })),
            agents: setAgentIds,
        },
    }
}
