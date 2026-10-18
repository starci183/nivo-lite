"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { allAgentIds, resumeNoteOf, useAdoptOnce } from "@/hooks/connection-wizard"
import { zaloWizardOf } from "@/hooks/connection-wire"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryZaloConnectionSwr } from "@/hooks/swr"
import type { AgentOption, WizardNote, ZaloWizardConnection } from "@/modules/types"
import { canSaveOaSecret, ZALO_STEPS, zaloFailureOf, zaloStartStepOf, type ZaloFields } from "./zalo-wizard.shared"

import { useZaloCommands, type ZaloCommands } from "./useZaloCommands"

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

    // The stored connection arrives once: adopt it while rendering (derived state), not from an effect.
    useAdoptOnce(resume.data, (data) => {
        const stored = zaloWizardOf(data)
        const failure = zaloFailureOf(input.returned, tw)
        setConn(stored)
        if (stored.agentIds.length > 0) setAgentIds(stored.agentIds)
        if (failure !== null) setNote({ tone: "negative", text: failure })
        setIndex(zaloStartStepOf(stored, failure !== null))
    })
    const step = ZALO_STEPS[index] ?? "app"
    const watch = useFirstEvent({ connectionId: conn === null ? null : conn.id, isActive: step === "verify" })
    const firstEvent = watch.event ?? (conn === null ? null : conn.firstEvent)

    const { saveSecret, authorize, go, create, finish } = createZaloWizardActions({
        conn,
        fields,
        startTransition,
        commands,
        setConn,
        setFields,
        setNote,
        setIndex,
        input,
        setAgentsOf,
        agentIds,
    })

    return {
        index,
        step,
        fields,
        conn,
        note: resumeNoteOf(note, resume.error),
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

type ZaloWizardActionsInput = {
    readonly conn: ZaloWizardConnection | null
    readonly fields: ZaloFields
    readonly startTransition: import("react").TransitionStartFunction
    readonly commands: ZaloCommands
    readonly setConn: import("react").Dispatch<import("react").SetStateAction<ZaloWizardConnection | null>>
    readonly setFields: import("react").Dispatch<import("react").SetStateAction<ZaloFields>>
    readonly setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>
    readonly setIndex: import("react").Dispatch<import("react").SetStateAction<number>>
    readonly input: ZaloWizardInput
    readonly setAgentsOf: ReturnType<typeof useSetConnectionAgents>
    readonly agentIds: ReadonlyArray<string>
}

const createZaloWizardActions = ({
    conn,
    fields,
    startTransition,
    commands,
    setConn,
    setFields,
    setNote,
    setIndex,
    input,
    setAgentsOf,
    agentIds,
}: ZaloWizardActionsInput) => {
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
    const finish = () => {
        if (conn === null) return input.onClose(false)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            input.onClose(true)
        })
    }
    return { saveSecret, authorize, go, fail, create, finish }
}
