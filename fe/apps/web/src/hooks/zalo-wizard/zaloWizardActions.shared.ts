import type { Dispatch, SetStateAction, TransitionStartFunction } from "react"
import type { useSetConnectionAgents } from "@/hooks/connections"
import type { WizardNote, ZaloWizardConnection } from "@/modules/types"
import type { ZaloFields } from "./zalo-wizard.shared"
import type { ZaloCommands } from "./useZaloCommands"

export type ZaloWizardActionsInput = {
    readonly conn: ZaloWizardConnection | null
    readonly fields: ZaloFields
    readonly startTransition: TransitionStartFunction
    readonly commands: ZaloCommands
    readonly setConn: Dispatch<SetStateAction<ZaloWizardConnection | null>>
    readonly setFields: Dispatch<SetStateAction<ZaloFields>>
    readonly setNote: Dispatch<SetStateAction<WizardNote | null>>
    readonly setIndex: Dispatch<SetStateAction<number>>
    readonly input: { readonly onClose: (changed: boolean) => void }
    readonly setAgentsOf: ReturnType<typeof useSetConnectionAgents>
    readonly agentIds: ReadonlyArray<string>
}

/** The commands the wizard's steps run. */
export type ZaloWizardActions = {
    readonly saveSecret: () => void
    readonly authorize: () => void
    readonly go: (to: number) => void
    readonly fail: (message: string) => void
    readonly create: () => void
    readonly finish: () => void
}

/** The wizard's commands: each runs in a transition, reports a refusal as a note and moves the step on success. */
export const createZaloWizardActions = ({
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
}: ZaloWizardActionsInput): ZaloWizardActions => {
    const saveSecret = (): void => {
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

    const authorize = (): void => {
        if (conn === null) return
        startTransition(async () => {
            const answer = await commands.authorize(conn.id)
            if (answer.kind !== "ok") return fail(answer.message)
            window.location.assign(answer.value)
        })
    }
    const go = (to: number): void => {
        setNote(null)
        setIndex(to)
    }
    const fail = (message: string): void => setNote({ tone: "negative", text: message })
    const create = (): void => {
        if (conn !== null) return go(1)
        startTransition(async () => {
            const answer = await commands.start(fields)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            go(1)
        })
    }
    const finish = (): void => {
        if (conn === null) return input.onClose(false)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            input.onClose(true)
        })
    }
    return { saveSecret, authorize, go, fail, create, finish }
}
