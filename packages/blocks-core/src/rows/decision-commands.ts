import type { ActionInput, ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { CommandView, DecisionQueueView, DecisionRowView } from "../views/views.types"
import type { FormErrors } from "./form-values"

/** The command id an edit runs under: the action of the queue is run with `{ id, command: "edit", values }`. */
export const EDIT_COMMAND = "edit"

/** What a queue runs its action with for one row: the row, the command it receives and, when it has any, the values. */
export const queueInputOf = (
    rowId: string,
    commandId: string,
    values?: Readonly<Record<string, string | number | boolean | null>>,
): ActionInput => (values === undefined ? { id: rowId, command: commandId } : { id: rowId, command: commandId, values })

/** What the edit of a row runs the action of its queue with. */
export const editInputOf = (
    rowId: string,
    values: Readonly<Record<string, string | number | boolean | null>>,
): ActionInput => queueInputOf(rowId, EDIT_COMMAND, values)

/**
 * How a declared command looks: the one that decides (`commit`), an alternative to it, a dismissal, a plain one, or one that
 * cannot be taken back (`danger`).
 */
export const COMMAND_INTENTS = ["commit", "alternative", "dismiss", "neutral", "danger"] as const

/** One look of a command. */
export type CommandIntent = (typeof COMMAND_INTENTS)[number]

/** The words and look the spec gives a command of the rows, by its id. */
export interface DeclaredCommand {
    /** The id the rows' commands carry. */
    readonly id: string
    /** The words on the control. */
    readonly label: SpecText
    /** The look of the control; absent keeps the look the row gives it. */
    readonly intent?: CommandIntent | undefined
}

/** The look a declared intent gives a command: the danger tone, or one of the plain looks with no danger. */
const lookOf = (intent: CommandIntent): Pick<CommandView, "isDanger" | "intent"> =>
    intent === "danger" ? { isDanger: true } : { isDanger: false, intent }

/** The command as the spec declares it: its words in the viewer's language, its look over the row's. */
const declaredCommand = (
    command: CommandView,
    declared: ReadonlyArray<DeclaredCommand>,
    words: (text: SpecText) => string,
): CommandView => {
    const match = declared.find((entry) => entry.id === command.id)
    if (match === undefined) return command
    return {
        ...command,
        label: words(match.label),
        ...(match.intent === undefined ? {} : lookOf(match.intent)),
    }
}

/** The command of a row, if it has one, as the spec declares it. */
const optionalCommand = (
    command: CommandView | null,
    declared: ReadonlyArray<DeclaredCommand>,
    words: (text: SpecText) => string,
): CommandView | null => (command === null ? null : declaredCommand(command, declared, words))

/** The edit command of a row with the words of the edit form's own label when the spec declares one. */
const editCommand = (
    command: CommandView | null,
    declared: ReadonlyArray<DeclaredCommand>,
    editLabel: string | undefined,
    words: (text: SpecText) => string,
): CommandView | null => {
    const declaredEdit = optionalCommand(command, declared, words)
    return declaredEdit === null || editLabel === undefined ? declaredEdit : { ...declaredEdit, label: editLabel }
}

/** The row with the words and look of its commands taken from the spec where the spec declares them. */
const declaredRow = (
    row: DecisionRowView,
    declared: ReadonlyArray<DeclaredCommand>,
    editLabel: string | undefined,
    words: (text: SpecText) => string,
): DecisionRowView => ({
    ...row,
    primary: optionalCommand(row.primary, declared, words),
    ...(row.alternative === undefined ? {} : { alternative: optionalCommand(row.alternative, declared, words) }),
    edit: editCommand(row.edit, declared, editLabel, words),
    menu: row.menu.map((command) => declaredCommand(command, declared, words)),
})

/** A command as a neutral control when it would be the filled primary. */
const plainCommand = (command: CommandView): CommandView =>
    command.intent === "commit" ? { ...command, intent: "neutral" } : command

/** A command of a row, if it has one, plain when it would be the filled primary. */
const plainOptional = (command: CommandView | null | undefined): CommandView | null | undefined =>
    command === null || command === undefined ? command : plainCommand(command)

/**
 * ONE filled primary per queue (`DNA-COMMON-ONE-ACCENT-FILL`): the first row that offers a main command (the read lists the oldest
 * first, so the one that has waited longest) keeps its commands as declared; on every other row a command that would be the filled
 * primary draws neutral. With one row nothing changes.
 */
export const onePrimaryQueue = (queue: DecisionQueueView): DecisionQueueView => {
    const first = queue.rows.findIndex((row) => row.primary !== null)
    return {
    ...queue,
    rows: queue.rows.map((row, index) =>
        index === first
            ? row
            : {
                  ...row,
                  primary: plainOptional(row.primary) ?? null,
                  ...(row.alternative === undefined ? {} : { alternative: plainOptional(row.alternative) }),
                  edit: plainOptional(row.edit) ?? null,
                  menu: row.menu.map((command) => plainCommand(command)),
              },
    ),
    }
}

/**
 * The queue with the words and look of its commands taken from the spec: a command whose id the spec declares draws the spec's
 * label (and intent), every other command draws as its row gives it. The edit command of a row draws the label of the edit form
 * when the spec declares one. What a command does and whether it is on offer stays the row's.
 */
export const declaredQueue = (
    queue: DecisionQueueView,
    declared: ReadonlyArray<DeclaredCommand>,
    editLabel: SpecText | undefined,
    words: (text: SpecText) => string,
): DecisionQueueView => {
    const label = editLabel === undefined ? undefined : words(editLabel)
    return { ...queue, rows: queue.rows.map((row) => declaredRow(row, declared, label, words)) }
}

/** What an edit form is told when its values were sent. */
export interface EditAnswer {
    /** Whether the edit was saved, so the form closes. */
    readonly isDone: boolean
    /** The fields the server refused, by field name. */
    readonly fields: FormErrors
    /** The words shown in the form when the edit was not saved and no field names the reason; null otherwise. */
    readonly notice: SpecText | null
}

/** What the form of an edit is told for the answer of the action. */
export const editAnswerOf = (outcome: ActionOutcome): EditAnswer => {
    if (outcome.ok) return { isDone: true, fields: {}, notice: null }
    if (outcome.reason === "invalid") return { isDone: false, fields: outcome.fields, notice: outcome.message ?? null }
    return { isDone: false, fields: {}, notice: outcome.message }
}

/** What the form of an edit is told when the run itself broke. */
export const editFailure: EditAnswer = { isDone: false, fields: {}, notice: { key: "slotError" } }
