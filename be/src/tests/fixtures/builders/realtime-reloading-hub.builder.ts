import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager, MockOf } from "@starci/jest-preset"
import type { Timer } from "@modules/platform/retry"
import type { ListenHandlers, NotificationListener, RealtimeTopic } from "@modules/platform/realtime"
import {
    SELECT_EVENT,
    SELECT_MISSED_EVENTS,
    SELECT_TOPIC_HIGHEST_SEQ,
    scriptRealtimeReads,
} from "./realtime-statements.builder"

/** One frame the proof topic carries. */
export interface Frame {
    readonly id: string
    readonly value: number
}

/** Whether a value is a frame; the guard the proof topic accepts frames by. */
export const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

/** The proof topic of one name, accepting frames. */
export const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

/** The frame of one numeric value. */
export const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

/** The committed event row of one sequence on a topic. */
export const rowOf = (seq: number, topic: string, payload: object) => ({ seq: String(seq), topic, payload })

/** The text a database notification carries for one topic and sequence. */
export const notification = (topic: string, seq: number): string => JSON.stringify({ topic, seq })

/** Waits for the queued microtasks and immediate callbacks of the hub to run. */
export const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

/** What a scripted statement answers for its arguments. */
export type Answer = (args: ReadonlyArray<unknown>) => unknown

/** One committed event row of the scripted table. */
export type Row = ReturnType<typeof rowOf>

/** A list argument of a scripted statement, or an empty list for anything else. */
const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

/** The strings of an unknown argument list. */
export const strings = (value: unknown): ReadonlyArray<string> =>
    listOf(value).filter((item): item is string => typeof item === "string")

/** The numbers of an unknown argument list. */
export const numbers = (value: unknown): ReadonlyArray<number> =>
    listOf(value).filter((item): item is number => typeof item === "number")

/** Does nothing. */
const noop = (): void => undefined

/** A gate a proof opens to release a held read. */
export const gateOf = () => {
    let open: () => void = noop
    const opened = new Promise<void>((resolve) => {
        open = resolve
    })
    return { open, opened }
}

/** The listener handlers the hub registered, to drive from the proof. */
export interface CapturedHandlers {
    current: ListenHandlers
}

/** One read the hub ran: the statement key and the arguments it carried. */
export interface ReadRecord {
    readonly key: string
    readonly args: ReadonlyArray<unknown>
}

/** A timer entry the hub scheduled. */
export interface ScheduledTimer {
    readonly callback: () => void
    readonly delayMs: number
    cancelled: boolean
}

/** Whether a table row sits after the cursor of its own topic; a topic with no cursor has none after it. */
const missedBy = (names: ReadonlyArray<string>, after: ReadonlyArray<number>, row: Row): boolean =>
    Number(row.seq) > (after[names.indexOf(row.topic)] ?? Infinity)

/**
 * The world of the Postgres reloading hub on a scripted database: the entity manager, the committed `table`, the statements the hub
 * runs (the highest sequence of a topic, the row a notification names, the rows after each topic's cursor; one the spec did not
 * script answers no rows), the listener whose handlers the proof drives, and the providers a testing module holds for the hub.
 */
export const reloadingHubWorld = (
    watermarks: Readonly<Record<string, number>>,
    listener: MockOf<NotificationListener>,
    timer: MockOf<Timer>,
) => {
    const em: MockEntityManager = mockEntityManager()
    const table: Array<Row> = []
    const answers = new Map<string, Answer>([
        [SELECT_TOPIC_HIGHEST_SEQ, ([topic]) => [{ seq: String(watermarks[String(topic)] ?? 0) }]],
        [SELECT_EVENT, ([seq]) => table.filter((row) => row.seq === String(seq))],
        [
            SELECT_MISSED_EVENTS,
            ([topics, cursors, limit]) => {
                const names = strings(topics)
                const after = numbers(cursors)
                return table
                    .filter((row) => missedBy(names, after, row))
                    .sort((left, right) => Number(left.seq) - Number(right.seq))
                    .slice(0, Number(limit))
            },
        ],
    ])
    const reads: Array<ReadRecord> = []
    em.query.mockResolvedValue([])
    const fakes = scriptRealtimeReads(em, (key, args) => {
        reads.push({ key, args })
        return Promise.resolve(answers.get(key)?.(args) ?? []).then(listOf)
    })
    const transactions = fakeTransaction(em)
    const handlers: CapturedHandlers = {
        current: {
            notify: () => undefined,
            probe: () => Promise.resolve(),
            lost: () => undefined,
            resumed: () => undefined,
        },
    }
    listener.start.mockImplementation((given) => {
        handlers.current = given
        return Promise.resolve()
    })
    const scheduled: Array<ScheduledTimer> = []
    timer.schedule.mockImplementation((callback, delayMs) => {
        const entry = { callback, delayMs, cancelled: false }
        scheduled.push(entry)
        return () => {
            entry.cancelled = true
        }
    })
    return { em, table, answers, reads, handlers, transactions, scheduled, fakes }
}

/** Drops the listener connection and brings it back, as a network blip would. */
export const dropAndResume = async (handlers: CapturedHandlers): Promise<void> => {
    handlers.current.lost()
    handlers.current.resumed()
    await settle()
}
