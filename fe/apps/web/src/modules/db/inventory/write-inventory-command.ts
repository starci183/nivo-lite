"use server"
import "server-only"

import { setTimeout as sleep } from "node:timers/promises"
import type { Json } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { inventoryCommandSchema } from "./inventory.mapper"

/** How long the member waits for the back end to run the command before the screen says it is still working. */
const WAIT_MS = 12_000
const POLL_MS = 300

/** The state of a submitted command as the row says it. */
type CommandState = DbOutcome<{
    readonly status: string
    readonly result: Json | null
    readonly errorMessage: string | null
}>

const readState = async (commandId: string): Promise<CommandState> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client.from("inventory_commands").select("status, result, error_message").eq("id", commandId).single(),
    )
    if (row.kind !== "ok") return row
    return dbOk({ status: row.value.status, result: row.value.result, errorMessage: row.value.error_message })
}

/** Reads the command again until the back end has settled it or the wait is over. */
const settled = async (commandId: string, waitedMs: number): Promise<DbOutcome<Json>> => {
    const state = await readState(commandId)
    if (state.kind !== "ok") return state
    if (state.value.status === "done") return dbOk(state.value.result)
    if (state.value.status === "failed") return dbFailure("invalid", state.value.errorMessage ?? "failed")
    if (waitedMs >= WAIT_MS) return dbFailure("unavailable", "timeout")
    await sleep(POLL_MS)
    return settled(commandId, waitedMs + POLL_MS)
}

/**
 * Submits one inventory command of a workspace and waits for the answer. The database function proves the caller is an active member and
 * starts the job; the back end runs it as that member and writes the answer on the command row. A refusal carries its sentence as the failure code.
 */
export const writeInventoryCommand = async (input: unknown): Promise<DbOutcome<Json>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = inventoryCommandSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "inventory-command")
    const client = await createServerDbClient()
    const submitted = toOutcome(
        await client.rpc("inventory_submit", {
            p_workspace: parsed.data.workspaceId,
            p_kind: parsed.data.kind,
            p_input: parsed.data.input,
        }),
    )
    if (submitted.kind !== "ok") return submitted
    return settled(submitted.value, 0)
}
