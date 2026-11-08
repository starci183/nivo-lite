"use client"

import { metaWizardOf } from "@/hooks/connection-wire"
import { allAgentIds, resumeNoteOf, resumeSlotOf, useAdoptOnce } from "@/hooks/connection-wizard"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryMetaConnectionSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import type {
    AgentOption,
    FirstEvent,
    DataSlot,
    MetaCheck,
    MetaWizardConnection,
    WizardNote,
    WizardResume,
} from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState, useTransition, type SetStateAction, type Dispatch } from "react"
import { createMetaWizardActions, META_STEPS, metaFailureOf, metaStartStepOf } from "./meta-wizard.shared"
import { useMetaCommands } from "./useMetaCommands"

/** What the Meta wizard needs from its drawer. */
interface MetaWizardInput {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** How the Facebook login ended when the browser came back: ok, denied, failed, expired, nopages or unavailable. */
    readonly returned: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

type UseMetaWizardResult = {
    reads: readonly SlotRead<unknown>[]
    index: number
    step: "connect" | "pick" | "agent" | "test"
    conn: MetaWizardConnection | null
    pageId: string
    agentIds: readonly string[]
    check: MetaCheck | null
    note: WizardNote | null
    isPending: boolean
    isChecking: boolean
    resume: DataSlot<WizardResume>
    firstEvent: FirstEvent | null
    on: {
        retry: () => void
        go: (to: number) => void
        login: () => void
        choose: () => void
        saveAgents: () => void
        runCheck: (repair: boolean) => void
        close: () => void
        done: () => void
        page: Dispatch<SetStateAction<string>>
        agents: Dispatch<SetStateAction<readonly string[]>>
    }
}

/**
 * The Meta wizard's state machine: log in with Facebook (the browser leaves for Meta and comes back here), pick the Page (its Instagram
 * account comes with it), attach the agents, then check what Meta really has and wait for the first message or comment.
 */
export const useMetaWizard = (input: MetaWizardInput): UseMetaWizardResult => {
    const tm = useTranslations("metaWizard")
    const commands = useMetaCommands()
    const setAgentsOf = useSetConnectionAgents()
    const [index, setIndex] = useState(0)
    const [conn, setConn] = useState<MetaWizardConnection | null>(null)
    const [pageId, setPageId] = useState("")
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [check, setCheck] = useState<MetaCheck | null>(null)
    const [note, setNote] = useState<WizardNote | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isChecking, startChecking] = useTransition()
    const resume = useQueryMetaConnectionSwr(input.resumeId, { revalidateOnFocus: false, shouldRetryOnError: false })
    const step = META_STEPS[index] ?? "connect"
    const watch = useFirstEvent({ connectionId: conn === null ? null : conn.id, isActive: step === "test" })
    const firstEvent = watch.event ?? (conn === null ? null : conn.firstEvent)
    const reads: ReadonlyArray<SlotRead<unknown>> = input.resumeId === undefined ? [] : [resume]

    // The stored connection arrives once: adopt it while rendering (derived state), not from an effect.
    useAdoptOnce(resume.data, (data) => {
        const stored = metaWizardOf(data)
        const failure = metaFailureOf(input.returned, tm)
        setConn(stored)
        if (stored.agentIds.length > 0) setAgentIds(stored.agentIds)
        const first = stored.pages[0]
        if (stored.pages.length === 1 && first !== undefined) setPageId(first.id)
        if (failure !== null) setNote({ tone: "negative", text: failure })
        else if (input.returned === "ok") setNote({ tone: "affirmative", text: tm("loggedIn") })
        setIndex(metaStartStepOf(stored, failure !== null))
    })

    const { go, runCheck, login, choose, saveAgents } = createMetaWizardActions({
        setNote,
        setIndex,
        conn,
        startChecking,
        commands,
        setCheck,
        startTransition,
        pageId,
        tm,
        setConn,
        setAgentsOf,
        agentIds,
    })

    return {
        reads,
        index,
        step,
        conn,
        pageId,
        agentIds,
        check,
        note: resumeNoteOf(note, resume.error),
        isPending,
        isChecking,
        resume: resumeSlotOf(input.resumeId, resume),
        firstEvent,
        on: {
            retry: (): void => {
                void resume.mutate()
            },
            go,
            login,
            choose,
            saveAgents,
            runCheck,
            close: (): void => input.onClose(conn !== null),
            done: (): void => input.onClose(true),
            page: setPageId,
            agents: setAgentIds,
        },
    }
}
