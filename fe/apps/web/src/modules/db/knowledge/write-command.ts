"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { commandSchema } from "./knowledge.mapper"

/** Asks the back end to carry out a command (a fact decision, a question to try, a document to delete...); answers the command id to follow. */
export const writeCommand = async (input: unknown): Promise<DbOutcome<string>> => {
    const parsed = commandSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "command-input")
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const client = await createServerDbClient()
    return toOutcome(
        await client.rpc("brain_command", {
            p_workspace: parsed.data.workspaceId,
            p_kind: parsed.data.kind,
            p_payload: parsed.data.payload,
        }),
    )
}
