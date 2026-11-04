"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { allAgentIds, resumeNoteOf, resumeSlotOf, useAdoptOnce } from "@/hooks/connection-wizard"
import { zaloWizardOf } from "@/hooks/connection-wire"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryZaloConnectionSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import type { AgentOption, FirstEvent, DataSlot, WizardNote, WizardResume, ZaloWizardConnection } from "@/modules/types"
import { canSaveOaSecret, ZALO_STEPS, zaloFailureOf, zaloStartStepOf, type ZaloFields } from "./zalo-wizard.shared"

import { useZaloCommands } from "./useZaloCommands"
import { createZaloWizardActions } from "./zaloWizardActions.shared"
import type { SetStateAction, Dispatch } from "react"

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

type UseZaloWizardResult = {
    reads: readonly SlotRead<unknown>[]
    index: number
    step: "app" | "follow" | "authorize" | "verify" | "agent"
    fields: ZaloFields
    conn: ZaloWizardConnection | null
    note: WizardNote | null
    isPending: boolean
    resume: DataSlot<WizardResume>
    firstEvent: FirstEvent | null
    agentIds: readonly string[]
    canSaveSecret: boolean
    on: {
        retry: () => void
        go: (to: number) => void
        create: () => void
        saveSecret: () => void
        authorize: () => void
        finish: () => void
        close: () => void
        name: (name: string) => void
        appId: (appId: string) => void
        appSecret: (appSecret: string) => void
        oaSecret: (oaSecret: string) => void
        agents: Dispatch<SetStateAction<readonly string[]>>
    }
}

/**
 * The Zalo wizard's state machine, like the bank one: name and app keys, set up the Zalo app (the OA Secret Key to paste), connect the
 * Official Account (the browser leaves for Zalo and comes back here), check (message the OA), attach to the agents.
 */
export const useZaloWizard = (input: ZaloWizardInput): UseZaloWizardResult => {
    const tw = useTranslations("connectionWizard")
    const commands = useZaloCommands()
    const setAgentsOf = useSetConnectionAgents()
    const [index, setIndex] = useState(0)
    const [fields, setFields] = useState<ZaloFields>({ name: "", appId: "", appSecret: "", oaSecret: "" })
    const [conn, setConn] = useState<ZaloWizardConnection | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [note, setNote] = useState<WizardNote | null>(null)
    const [isPending, startTransition] = useTransition()
    const lostReturn = input.resumeId === undefined ? zaloFailureOf(input.returned, tw) : null
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
    const reads: ReadonlyArray<SlotRead<unknown>> = input.resumeId === undefined ? [] : [resume]

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
        reads,
        index,
        step,
        fields,
        conn,
        note: resumeNoteOf(note ?? (lostReturn === null ? null : { tone: "negative", text: lostReturn }), resume.error),
        isPending,
        resume: resumeSlotOf(input.resumeId, resume),
        firstEvent,
        agentIds,
        canSaveSecret: canSaveOaSecret(conn, fields),
        on: {
            retry: (): void => {
                void resume.mutate()
            },
            go,
            create,
            saveSecret,
            authorize,
            finish,
            close: (): void => input.onClose(conn !== null),
            name: (name: string): void => setFields((current) => ({ ...current, name })),
            appId: (appId: string): void => setFields((current) => ({ ...current, appId })),
            appSecret: (appSecret: string): void => setFields((current) => ({ ...current, appSecret })),
            oaSecret: (oaSecret: string): void => setFields((current) => ({ ...current, oaSecret })),
            agents: setAgentIds,
        },
    }
}
