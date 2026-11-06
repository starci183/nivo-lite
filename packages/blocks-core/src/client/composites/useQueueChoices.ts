import { useState } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { choiceOf } from "../../rows/decision-choices"
import type { Choice } from "../../rows/decision-choices"

/** The row command whose overlay is open, with the row it is about. */
export interface PendingChoice {
    /** The row the command is about. */
    readonly rowId: string
    /** The choice the command is declared with. */
    readonly choice: Choice
}

/** What the commands of a queue give back. */
export interface QueueCommands {
    /** The open choice; null when no overlay is open. */
    readonly pending: PendingChoice | null
    /** Closes the open overlay. */
    readonly close: () => void
    /** Runs the action for a row with the command it receives and, when it has any, its values. */
    readonly runWith: (rowId: string, commandId: string, values?: Readonly<Record<string, string>>) => Promise<void>
    /** Presses a command of a row: it runs at once, or opens the overlay its choice declares. */
    readonly press: (rowId: string, commandId: string) => void
}

/** The commands of a queue: the action that runs them, the choices that open an overlay first, and what shows when one fails. */
export const useQueueCommands = (
    command: ActionHandle,
    choices: ReadonlyArray<Choice> | undefined,
    onFailure: () => void,
): QueueCommands => {
    const [pending, setPending] = useState<PendingChoice | null>(null)
    const runWith = (rowId: string, commandId: string, values?: Readonly<Record<string, string>>): Promise<void> =>
        command
            .run(values === undefined ? { id: rowId, command: commandId } : { id: rowId, command: commandId, values })
            .then((outcome) => {
                if (!outcome.ok) onFailure()
            })
            .catch(onFailure)
    const press = (rowId: string, commandId: string): void => {
        if (!command.isAllowed) return
        const choice = choiceOf(choices, commandId)
        if (choice === null) void runWith(rowId, commandId)
        else setPending({ rowId, choice })
    }
    return { pending, close: () => setPending(null), runWith, press }
}
