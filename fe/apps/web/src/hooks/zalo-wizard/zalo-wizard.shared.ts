import type { Dispatch, SetStateAction, TransitionStartFunction } from "react"
import type { CatalogReader } from "@/hooks/connection-wizard"
import type { useSetConnectionAgents } from "@/hooks/connections"
import type { WizardNote, ZaloWizardConnection } from "@/modules/types"
import type { ZaloCommands } from "./useZaloCommands"

/** The steps of the Zalo wizard, in order. */
export const ZALO_STEPS = ["app", "follow", "authorize", "verify", "agent"] as const

/** The least length of the OA Secret Key the owner pastes from Zalo. */
const MIN_SECRET_LENGTH = 8

/** What the owner types on the first two steps. */
export interface ZaloFields {
    readonly name: string
    readonly appId: string
    readonly appSecret: string
    readonly oaSecret: string
}

/** The sentence for a sign-in that did not end well, or null when it did (or there was none). */
export const zaloFailureOf = (returned: string | undefined, tw: CatalogReader): string | null => {
    if (returned === "denied") return tw("zaloAuthDenied")
    if (returned === "failed") return tw("zaloAuthFailed")
    return returned === "expired" ? tw("zaloAuthExpired") : null
}

/** Where a resumed connection continues: back to the sign-in after a failure, on to the check once authorized, else where the keys stand. */
export const zaloStartStepOf = (conn: ZaloWizardConnection, failed: boolean): number => {
    if (failed) return 2
    if (conn.authorized) return 3
    return conn.oaSecretSaved ? 2 : 1
}

/** Whether the follow-along step may go on: the OA Secret Key is stored, or a long enough one is typed. */
export const canSaveOaSecret = (conn: ZaloWizardConnection | null, fields: ZaloFields): boolean =>
    conn?.oaSecretSaved || fields.oaSecret.trim().length >= MIN_SECRET_LENGTH

/** The state, commands and callbacks the wizard's actions read and write. */
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
