import "server-only"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbFailureKind, DbOutcome } from "../outcome"

/** One console command for the back end: the workspace it acts in, what to run and the fields it takes. */
export interface CommandRequest {
    readonly workspaceId: string
    readonly kind: string
    readonly input: Readonly<Record<string, unknown>>
}

/** How long the caller waits for the back end, and how often it looks. */
const WAIT_MS = 30_000
const POLL_MS = 400

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** The failure kind of a back end failure kind. */
const failureKindOf = (kind: unknown): DbFailureKind => {
    if (kind === "forbidden" || kind === "unauthenticated") return "refused"
    if (kind === "not-found") return "not-found"
    return kind === "invalid" || kind === "conflict" ? "invalid" : "unavailable"
}

/** The outcome the back end wrote: its answer, or the code of its failure. */
const outcomeOf = <T>(written: unknown): DbOutcome<T> => {
    if (!isRecord(written)) return dbFailure("unavailable", "outcome")
    if (written.ok === true) return dbOk(written.value as T)
    return dbFailure(failureKindOf(written.kind), typeof written.code === "string" ? written.code : "failed")
}

/**
 * Hands a command to the back end through the database and waits for its outcome. The browser never calls the back end: the
 * connection_command_submit function proves the membership and queues the command, a job of the back end runs it as the signed-in
 * member and writes the outcome to the row, and connection_command_take hands the outcome over once (an answer can hold a one-time
 * secret, so the row is deleted when it is taken).
 */
export const submitCommand = async <T>(request: CommandRequest): Promise<DbOutcome<T>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const db = await createServerDbClient()
    const submitted = toOutcome(
        await db.rpc("connection_command_submit", {
            p_workspace: request.workspaceId,
            p_kind: request.kind,
            p_input: request.input as never,
        }),
    )
    if (submitted.kind !== "ok") return submitted
    const deadline = Date.now() + WAIT_MS
    while (Date.now() < deadline) {
        await pause(POLL_MS)
        const taken = toOutcome(await db.rpc("connection_command_take", { p_id: submitted.value }))
        if (taken.kind !== "ok") return taken
        const answer = taken.value
        if (!isRecord(answer) || answer.status === "missing") return dbFailure("not-found", "command")
        if (answer.status === "done") return outcomeOf<T>(answer.outcome)
    }
    return dbFailure("unavailable", "timeout")
}
