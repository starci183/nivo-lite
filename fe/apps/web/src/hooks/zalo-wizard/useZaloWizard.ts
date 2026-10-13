import { useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { allAgentIds, useChannelReason, useFirstEvent, useLatest } from "@/hooks/connection-wizard"
import type { AgentOption, WizardNote, ZaloWizardConnection } from "@/modules/types"
import { canSaveOaSecret, ZALO_STEPS, zaloFailureOf, zaloStartStepOf } from "./zalo-wizard.shared"
import type { ZaloActions, ZaloFields } from "./zalo-wizard.shared"

/** What the Zalo wizard needs from its drawer. */
interface ZaloWizardInput {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** How the Zalo sign-in ended when the browser came back: ok, denied, failed or expired. */
    readonly returned: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    readonly actions: ZaloActions
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The Zalo wizard's state machine, like the bank one: name and app keys, set up the Zalo app (the OA Secret Key to paste), connect the
 * Official Account (the browser leaves for Zalo and comes back here), check (message the OA), attach to the agents.
 */
export const useZaloWizard = (input: ZaloWizardInput) => {
    const tw = useTranslations("connectionWizard")
    const reasonOf = useChannelReason()
    const [index, setIndex] = useState(0)
    const [fields, setFields] = useState<ZaloFields>({ name: "", appId: "", appSecret: "", oaSecret: "" })
    const [conn, setConn] = useState<ZaloWizardConnection | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(allAgentIds(input.agents))
    const [note, setNote] = useState<WizardNote | null>(null)
    const [resumed, setResumed] = useState(false)
    const [isPending, startTransition] = useTransition()
    const actions = useLatest(input.actions)
    const step = ZALO_STEPS[index] ?? "app"
    const watch = useFirstEvent({
        connectionId: conn === null ? null : conn.id,
        isActive: step === "verify",
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
                const failure = zaloFailureOf(input.returned, tw)
                setConn(answer.value)
                if (answer.value.agentIds.length > 0) setAgentIds(answer.value.agentIds)
                if (failure !== null) setNote({ tone: "negative", text: failure })
                setIndex(zaloStartStepOf(answer.value, failure !== null))
            }
            setResumed(true)
        })
        return () => {
            live = false
        }
    }, [input.resumeId, input.returned, actions, reasonOf, tw])

    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }
    const fail = (code: string) => setNote({ tone: "negative", text: reasonOf(code) })

    const create = () => {
        if (conn !== null) return go(1)
        startTransition(async () => {
            const answer = await input.actions.start(fields)
            if (answer.kind !== "ok") return fail(answer.code)
            setConn(answer.value)
            go(1)
        })
    }

    const saveSecret = () => {
        if (conn === null) return
        if (conn.oaSecretSaved && fields.oaSecret.trim() === "") return go(2)
        startTransition(async () => {
            const answer = await input.actions.saveOaSecret(conn.id, fields.oaSecret)
            if (answer.kind !== "ok") return fail(answer.code)
            setConn({ ...conn, oaSecretSaved: true })
            setFields((current) => ({ ...current, oaSecret: "" }))
            go(2)
        })
    }

    const authorize = () => {
        if (conn === null) return
        startTransition(async () => {
            const answer = await input.actions.authorize(conn.id)
            if (answer.kind !== "ok") return fail(answer.code)
            window.location.assign(answer.value.url)
        })
    }

    const finish = () => {
        if (conn === null) return input.onClose(false)
        startTransition(async () => {
            const answer = await input.actions.setAgents(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.code)
            input.onClose(true)
        })
    }

    return {
        index,
        step,
        fields,
        conn,
        note,
        isPending,
        isLoading: input.resumeId !== undefined && !resumed,
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
