"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { allAgentIds, resumeNoteOf, useAdoptOnce } from "@/hooks/connection-wizard"
import { metaWizardOf } from "@/hooks/connection-wire"
import { useFirstEvent, useSetConnectionAgents } from "@/hooks/connections"
import { useQueryMetaConnectionSwr } from "@/hooks/swr"
import type { AgentOption, MetaCheck, MetaWizardConnection, WizardNote } from "@/modules/types"
import { META_STEPS, metaFailureOf, metaStartStepOf } from "./meta-wizard.shared"
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

/**
 * The Meta wizard's state machine: log in with Facebook (the browser leaves for Meta and comes back here), pick the Page (its Instagram
 * account comes with it), attach the agents, then check what Meta really has and wait for the first message or comment.
 */
export const useMetaWizard = (input: MetaWizardInput) => {
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

    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }
    const fail = (message: string) => setNote({ tone: "negative", text: message })

    const runCheck = (repair: boolean) => {
        if (conn === null) return
        startChecking(async () => {
            const answer = await commands.check(conn.id, repair)
            if (answer.kind !== "ok") return fail(answer.message)
            setCheck(answer.value)
        })
    }

    const login = () =>
        startTransition(async () => {
            setNote(null)
            const answer = await commands.authorize(conn === null ? undefined : conn.id)
            if (answer.kind !== "ok") return fail(answer.message)
            window.location.assign(answer.value)
        })

    const choose = () => {
        if (conn === null || pageId === "") return setNote({ tone: "negative", text: tm("pickPick") })
        startTransition(async () => {
            const answer = await commands.choosePage(conn.id, pageId)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            go(2)
        })
    }

    const saveAgents = () => {
        if (conn === null) return go(3)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            go(3)
            runCheck(false)
        })
    }

    return {
        index,
        step,
        conn,
        pageId,
        agentIds,
        check,
        note: resumeNoteOf(note, resume.error),
        isPending,
        isChecking,
        isLoading: input.resumeId !== undefined && resume.data === undefined && resume.error === undefined,
        firstEvent,
        on: {
            go,
            login,
            choose,
            saveAgents,
            runCheck,
            close: () => input.onClose(conn !== null),
            done: () => input.onClose(true),
            page: setPageId,
            agents: setAgentIds,
        },
    }
}
