import { useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { allAgentIds, useChannelReason, useFirstEvent, useLatest } from "@/hooks/connection-wizard"
import type { AgentOption, MetaCheck, MetaWizardConnection, WizardNote } from "@/modules/types"
import { META_STEPS, metaFailureOf, metaStartStepOf } from "./meta-wizard.shared"
import type { MetaActions } from "./meta-wizard.shared"

/** What the Meta wizard needs from its drawer. */
interface MetaWizardInput {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** How the Facebook login ended when the browser came back: ok, denied, failed, expired, nopages or unavailable. */
    readonly returned: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    readonly actions: MetaActions
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The Meta wizard's state machine: log in with Facebook (the browser leaves for Meta and comes back here), pick the Page (its Instagram
 * account comes with it), attach the agents, then check what Meta really has and wait for the first message or comment.
 */
export const useMetaWizard = (input: MetaWizardInput) => {
    const tm = useTranslations("metaWizard")
    const reasonOf = useChannelReason()
    const [index, setIndex] = useState(0)
    const [conn, setConn] = useState<MetaWizardConnection | null>(null)
    const [pageId, setPageId] = useState("")
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [check, setCheck] = useState<MetaCheck | null>(null)
    const [note, setNote] = useState<WizardNote | null>(null)
    const [resumed, setResumed] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [isChecking, startChecking] = useTransition()
    const actions = useLatest(input.actions)
    const step = META_STEPS[index] ?? "connect"
    const watch = useFirstEvent({
        connectionId: conn === null ? null : conn.id,
        isActive: step === "test",
        check: input.actions.checkFirstEvent,
    })
    const firstEvent = watch.event ?? (conn === null ? null : conn.firstEvent)

    useEffect(() => {
        if (input.resumeId === undefined) return undefined
        const connectionId = input.resumeId
        let live = true
        startTransition(async () => {
            const answer = await actions.current.resume(connectionId)
            if (!live) return
            if (answer.kind !== "ok") setNote({ tone: "negative", text: reasonOf(answer.code) })
            else {
                const failure = metaFailureOf(input.returned, tm)
                setConn(answer.value)
                if (answer.value.agentIds.length > 0) setAgentIds(answer.value.agentIds)
                const first = answer.value.pages[0]
                if (answer.value.pages.length === 1 && first !== undefined) setPageId(first.id)
                if (failure !== null) setNote({ tone: "negative", text: failure })
                else if (input.returned === "ok") setNote({ tone: "affirmative", text: tm("loggedIn") })
                setIndex(metaStartStepOf(answer.value, failure !== null))
            }
            setResumed(true)
        })
        return () => {
            live = false
        }
    }, [input.resumeId, input.returned, actions, reasonOf, tm])

    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }
    const fail = (code: string) => setNote({ tone: "negative", text: reasonOf(code) })

    const runCheck = (repair: boolean) => {
        if (conn === null) return
        startChecking(async () => {
            const answer = await input.actions.check(conn.id, repair)
            if (answer.kind !== "ok") return fail(answer.code)
            setCheck(answer.value)
        })
    }

    const login = () =>
        startTransition(async () => {
            setNote(null)
            const answer = await input.actions.authorize(conn === null ? undefined : conn.id)
            if (answer.kind !== "ok") return fail(answer.code)
            window.location.assign(answer.value.url)
        })

    const choose = () => {
        if (conn === null || pageId === "") return setNote({ tone: "negative", text: tm("pickPick") })
        startTransition(async () => {
            const answer = await input.actions.choosePage(conn.id, pageId)
            if (answer.kind !== "ok") return fail(answer.code)
            setConn(answer.value)
            go(2)
        })
    }

    const saveAgents = () => {
        if (conn === null) return go(3)
        startTransition(async () => {
            const answer = await input.actions.setAgents(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.code)
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
        note,
        isPending,
        isChecking,
        isLoading: input.resumeId !== undefined && !resumed,
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
