"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { isKnowledgeId } from "./knowledge.mapper"

/** Where a command stands: the back end carries it out and closes it with a result or a stored code. */
export interface BrainCommandState {
    readonly status: "queued" | "running" | "done" | "failed"
    readonly result: unknown
    readonly errorCode: string | null
}

const STATUSES: ReadonlyArray<BrainCommandState["status"]> = ["queued", "running", "done", "failed"]

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Reads the answer of the wait: the status, the result and the stored code of a failure. */
const stateOf = (answer: unknown): BrainCommandState => {
    const fields = isRecord(answer) ? answer : {}
    return {
        status: STATUSES.find((known) => known === fields.status) ?? "queued",
        result: fields.result,
        errorCode: typeof fields.errorCode === "string" ? fields.errorCode : null,
    }
}

/** Waits a few seconds for the back end to close a command the caller asked for, then says how it stands; only the person who asked may see it. */
export const writeCommandWait = async (commandId: unknown): Promise<DbOutcome<BrainCommandState>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    if (!isKnowledgeId(commandId)) return dbFailure("invalid", "command-id")
    const client = await createServerDbClient()
    const answer = toOutcome(await client.rpc("brain_command_wait", { p_id: commandId }))
    return answer.kind === "ok" ? dbOk(stateOf(answer.value)) : answer
}
