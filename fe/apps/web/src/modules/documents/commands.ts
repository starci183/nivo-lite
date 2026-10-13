import type { BrainCommandState, DbOutcome } from "@/modules/db"

/** What was asked of the back end. */
export interface CommandCall {
    readonly workspaceId: string
    readonly kind: string
    readonly payload: Readonly<Record<string, unknown>>
}

/** How a command ended: with its result, or with the stored code of why it did not. */
export type CommandSettled =
    { readonly isDone: true; readonly result: unknown } | { readonly isDone: false; readonly code: string }

/** The two server actions a command goes through. */
export interface CommandActions {
    readonly write: (input: CommandCall) => Promise<DbOutcome<string>>
    readonly wait: (id: string) => Promise<DbOutcome<BrainCommandState>>
}

/** How many times the wait is asked before the command is given up on; each ask holds for a few seconds on the server. */
const MAX_WAITS = 12

/** The settled state of a command that is closed, or null while it is still queued or running. */
const settledOf = (state: BrainCommandState): CommandSettled | null => {
    if (state.status === "done") return { isDone: true, result: state.result }
    if (state.status === "failed") return { isDone: false, code: state.errorCode ?? "BRAIN_COMMAND_FAILED" }
    return null
}

/** Asks the wait until the back end has closed the command, or the asks are used up. */
const follow = async (actions: CommandActions, id: string, left: number): Promise<CommandSettled> => {
    const seen = await actions.wait(id)
    if (seen.kind !== "ok") return { isDone: false, code: seen.code }
    const settled = settledOf(seen.value)
    if (settled !== null) return settled
    return left <= 1 ? { isDone: false, code: "command-timeout" } : follow(actions, id, left - 1)
}

/** Asks the back end to carry out a command and waits for how it ended. */
export const runCommand = async (actions: CommandActions, request: CommandCall): Promise<CommandSettled> => {
    const queued = await actions.write(request)
    return queued.kind === "ok" ? follow(actions, queued.value, MAX_WAITS) : { isDone: false, code: queued.code }
}

/** The catalog key (`knowledge` namespace) that explains why a command did not go through. */
export const commandErrorKey = (code: string): string => `cmd_${code}`
