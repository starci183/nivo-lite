import "server-only"

import { cache } from "react"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { shellFromJson } from "./shell.mapper"
import type { ShellFacts } from "./shell.mapper"

/** The Founding 50 window the shell function evaluates membership against. */
export type ShellWindow = { readonly from: string; readonly to: string }

/** Everything the console frame reads, in ONE request (SQL function `shell_data`, under the caller RLS). Once per request. */
export const readShell = cache(async (workspaceId: string, window: ShellWindow): Promise<DbOutcome<ShellFacts>> => {
    const client = await createServerDbClient()
    const outcome = toOutcome(
        await client.rpc("shell_data", { ws: workspaceId, founding_from: window.from, founding_to: window.to }),
    )
    if (outcome.kind !== "ok") return outcome
    const facts = shellFromJson(outcome.value)
    return facts === null ? dbFailure("invalid", "shell-shape") : dbOk(facts)
})
