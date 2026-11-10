import type { ScheduledItem } from "./agent-doors.contracts"

/** An item key read back: which store holds the job and how it stood when the list was read. */
export type ScheduledKey =
    | { readonly kind: "task"; readonly taskId: string; readonly at: Date }
    | { readonly kind: "schedule"; readonly triggerId: string; readonly slot: Date }
    | {
          readonly kind: "deadline"
          readonly runId: string
          readonly stepKey: string
          readonly repeats: number
          readonly answered: number
      }

const SEPARATOR = ":"

/** The longest item key taken back. */
export const ITEM_KEY_MAX = 300

/** The key of an agent task's timer at its wake time: `task:<taskId>:<epoch ms>`. */
export const taskKeyOf = (taskId: string, at: Date): string => ["task", taskId, String(at.getTime())].join(SEPARATOR)

/** The key of a clock trigger's next slot: `schedule:<triggerId>:<epoch ms>`. */
export const scheduleKeyOf = (triggerId: string, slot: Date): string =>
    ["schedule", triggerId, String(slot.getTime())].join(SEPARATOR)

/** The key of a stop's deadline as it stands: `deadline:<runId>:<stepKey>:<repeats>.<answers>` (the deadline job's own identity). */
export const deadlineKeyOf = (runId: string, stepKey: string, repeats: number, answered: number): string =>
    ["deadline", runId, stepKey, `${String(repeats)}.${String(answered)}`].join(SEPARATOR)

const momentOf = (text: string | undefined): Date | null => {
    if (text === undefined || !/^\d{1,15}$/.test(text)) return null
    return new Date(Number(text))
}

const countsOf = (text: string | undefined): { readonly repeats: number; readonly answered: number } | null => {
    const match = /^(\d{1,6})\.(\d{1,6})$/.exec(text ?? "")
    return match === null ? null : { repeats: Number(match[1]), answered: Number(match[2]) }
}

/** The item a key names, or null for a text that is not an item key. */
export const scheduledKeyOf = (key: string): ScheduledKey | null => {
    if (key.length > ITEM_KEY_MAX) return null
    const [kind, id, ...rest] = key.split(SEPARATOR)
    if (id === undefined || id === "") return null
    if (kind === "task" || kind === "schedule") {
        const at = rest.length === 1 ? momentOf(rest[0]) : null
        if (at === null) return null
        return kind === "task" ? { kind, taskId: id, at } : { kind, triggerId: id, slot: at }
    }
    if (kind !== "deadline" || rest.length < 2) return null
    const counts = countsOf(rest.at(-1))
    const stepKey = rest.slice(0, -1).join(SEPARATOR)
    return counts === null || stepKey === "" ? null : { kind, runId: id, stepKey, ...counts }
}

/** The list order: the soonest first, then by key so two items due at once keep their place. */
export const bySoonest = (a: ScheduledItem, b: ScheduledItem): number =>
    a.dueAt.getTime() - b.dueAt.getTime() || a.id.localeCompare(b.id)
