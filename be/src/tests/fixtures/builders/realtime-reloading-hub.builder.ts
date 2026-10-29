import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, fakeQueryBuilder } from "@starci/jest-preset"
import type { QueryBuilderAnswers, MockEntityManager } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import {
    PostgresReloadingHubService,
    REALTIME_LISTENER,
    REALTIME_MANAGERS,
    REALTIME_TIMER,
} from "@modules/platform/realtime"
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

/** The strings of an unknown argument list. */
export const strings = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

/** The numbers of an unknown argument list. */
export const numbers = (value: unknown): ReadonlyArray<number> =>
    Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : []

/** A gate a proof opens to release a held read. */
export const gateOf = () => {
    let open: () => void = () => undefined
    const opened = new Promise<void>((resolve) => {
        open = resolve
    })
    return { open, opened }
}

/** The listener handlers the hub registered, to drive from the proof. */
export interface CapturedHandlers {
    current: ListenHandlers
}

/**
 * The hub on a scripted database. `table` holds the committed rows; the statements the hub runs answer from it: the highest sequence of
 * a topic, the row a notification names, and the rows after each topic's cursor. A statement the spec did not script answers no rows.
 */
export const build = async (watermarks: Readonly<Record<string, number>> = {}) => {
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
                    .filter((row) => Number(row.seq) > (after[names.indexOf(row.topic)] ?? Infinity))
                    .sort((left, right) => Number(left.seq) - Number(right.seq))
                    .slice(0, Number(limit))
            },
        ],
    ])
    em.query.mockImplementation((sql: string, args: Array<unknown> = []) =>
        Promise.resolve(answers.get(sql)?.(args) ?? []),
    )
    scriptRealtimeReads(em)
    const transactions = fakeTransaction(em)
    const handlers: CapturedHandlers = {
        current: {
            notify: () => undefined,
            probe: () => Promise.resolve(),
            lost: () => undefined,
            resumed: () => undefined,
        },
    }
    const listener = mock<NotificationListener>()
    listener.start.mockImplementation((given) => {
        handlers.current = given
        return Promise.resolve()
    })
    const scheduled: Array<{ readonly callback: () => void; readonly delayMs: number; cancelled: boolean }> = []
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback, delayMs) => {
        const entry = { callback, delayMs, cancelled: false }
        scheduled.push(entry)
        return () => {
            entry.cancelled = true
        }
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresReloadingHubService,
            { provide: REALTIME_MANAGERS, useValue: [em] },
            { provide: REALTIME_LISTENER, useValue: listener },
            { provide: LOGGER, useValue: logger },
            { provide: REALTIME_TIMER, useValue: timer },
        ],
    }).compile()
    const hub = moduleRef.get(PostgresReloadingHubService)
    await hub.onModuleInit()
    return { hub, em, table, answers, listener, logger, handlers, transactions, scheduled }
}

/** Drops the listener connection and brings it back, as a network blip would. */
export const dropAndResume = async (handlers: CapturedHandlers): Promise<void> => {
    handlers.current.lost()
    handlers.current.resumed()
    await settle()
}

/** The hub over a manager whose query builders answer the given terminals, in the order of the builders it asks for. */
export const buildReads = async (...answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) em.createQueryBuilder.mockReturnValueOnce(fake.builder as never)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresReloadingHubService,
            { provide: REALTIME_MANAGERS, useValue: [em] },
            { provide: REALTIME_LISTENER, useValue: mock<NotificationListener>() },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: REALTIME_TIMER, useValue: mock<Timer>() },
        ],
    }).compile()
    return { hub: moduleRef.get(PostgresReloadingHubService), em, fakes }
}
