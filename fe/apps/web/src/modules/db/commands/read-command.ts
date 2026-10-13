import "server-only"

import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { commandFailure, commandStateOf } from "./commands.mapper"

/** The pause between two looks at a command. */
const POLL_MS = 400

/** How long a Server Action waits for the back end to serve a command. */
const WAIT_MS = 25_000

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Waits for the back end to settle a command the caller asked for and answers its result. The command row is the caller's own (RLS in
 * `read_app_command`); a link in the result is handed over once. A command still waiting after the wait is `unavailable`.
 */
export const awaitCommand = async (commandId: string): Promise<DbOutcome<Readonly<Record<string, unknown>>>> => {
    const client = await createServerDbClient()
    const until = Date.now() + WAIT_MS
    for (;;) {
        const { data, error } = await client.rpc("read_app_command", { p_id: commandId })
        if (error !== null) return rpcFailure(error)
        const command = commandStateOf(data)
        if (command === null) return dbFailure("unavailable", "command-shape")
        if (command.state === "done") return dbOk(command.result ?? {})
        if (command.state === "failed") return commandFailure(command.errorCode)
        if (Date.now() >= until) return dbFailure("unavailable", "command-timeout")
        await pause(POLL_MS)
    }
}
