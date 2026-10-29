import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { BaseEvent, EventBusService, EventConsumerService } from "@modules/platform/event-bus"
import type {
    EventBusOptions,
    EventConsumer,
    EventDelivery,
    EventPayload,
    ParsedEvent,
} from "@modules/platform/event-bus"
import { InboxService, inboxEntities } from "@modules/platform/inbox"
import { sql } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { Logger } from "@modules/platform/logging"
import type { LiteWorld } from "./lite-world.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** Lets the local role creator enter the backend role; the membership is removed again when the proof ends. */
const GRANT_BACKEND_ROLE = sql`GRANT app_be TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`
const REVOKE_BACKEND_ROLE = sql`REVOKE app_be FROM CURRENT_USER`

/** Counts the rows of one pgmq table whose name arrives as a parameter, never spliced into the text. */
const COUNT_PGMQ_TABLE = sql`
    SELECT (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM pgmq.%I', $1::text), false, true, '')))[1]::text AS n`

/** Empties the pgmq tables named by the transaction-local setting `proof.tables` (comma separated). */
const EMPTY_PGMQ_TABLES = sql`
    DO $proof$
    DECLARE name text;
    BEGIN
        FOREACH name IN ARRAY string_to_array(current_setting('proof.tables'), ',') LOOP
            EXECUTE format('DELETE FROM pgmq.%I', name);
        END LOOP;
    END $proof$`

/** What the application role is refused: the pgmq schema itself. */
const READ_PGMQ_META = sql`SELECT * FROM pgmq.meta`

/** The payload of a spec event. */
export interface SpecPayload extends EventPayload {
    readonly subjectId: string
}

/** One class stands for every spec topic: only the event name differs. */
export class SpecEvent extends BaseEvent {
    static readonly eventName = "spec"
    static readonly version = 1

    constructor(
        readonly eventName: string,
        readonly eventId: string,
        readonly payload: SpecPayload,
    ) {
        super()
    }

    /** Reads an envelope back into a spec event, or null when it is not one. */
    static parse(envelope: unknown): ParsedEvent<SpecEvent> {
        if (typeof envelope !== "object" || envelope === null) return null
        const name: unknown = Reflect.get(envelope, "eventName")
        const id: unknown = Reflect.get(envelope, "eventId")
        const body: unknown = Reflect.get(envelope, "payload")
        if (typeof name !== "string" || typeof id !== "string") return null
        if (typeof body !== "object" || body === null) return null
        const dedupeKey: unknown = Reflect.get(body, "dedupeKey")
        const subjectId: unknown = Reflect.get(body, "subjectId")
        if (typeof dedupeKey !== "string" || typeof subjectId !== "string") return null
        return new SpecEvent(name, id, { dedupeKey, subjectId })
    }
}

/** A recording logger, so a proof can assert what the runner reported. */
export interface RecordingLogger extends Logger {
    readonly info: jest.Mock
    readonly warn: jest.Mock
    readonly error: jest.Mock
}

/** The event bus connected as the application role, with an owner connection to count and reset the queues. */
export interface EventBusProof {
    /** The application role's manager: it publishes and consumes. */
    readonly app: EntityManager
    /** The publisher on the application manager. */
    readonly publisher: EventBusService
    /** The logger the runner reports to. */
    readonly logger: RecordingLogger
    /** The rows of one pgmq table. */
    readonly count: (table: string) => Promise<number>
    /** Empties the named pgmq tables. */
    readonly reset: (tables: ReadonlyArray<string>) => Promise<void>
    /** A runner on the application manager. */
    readonly runnerOf: (options?: EventBusOptions) => EventConsumerService
    /** A thin door that claims (consumer, dedupeKey) and records the effect in the same transaction. */
    readonly door: (effects: Array<string>, fail?: () => boolean) => EventConsumer<SpecEvent>
    /** Publishes one spec event in its own committed transaction. */
    readonly publish: (name: string, key: string) => Promise<void>
    /** Resolves when the application role is refused the pgmq schema. */
    readonly appIsRefusedPgmq: () => Promise<boolean>
}

/** Waits a fixed time, for the visibility timeout of a delivery. */
export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const loggerOf = (): RecordingLogger => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })

/** Opens the application-role connection of the world's database and registers its removal. */
export const openEventBusProof = async (world: LiteWorld): Promise<EventBusProof> => {
    const admin = world.db.primary
    await admin.query(GRANT_BACKEND_ROLE)
    const { options } = admin.connection
    if (options.type !== "postgres" || typeof options.url !== "string") {
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { url: "" } })
    }
    const { url } = options
    const source = new DataSource({
        type: "postgres",
        url,
        entities: [...inboxEntities],
        synchronize: false,
        extra: { options: "-c role=app_be" },
    })
    await source.initialize()
    world.cleanup(async () => {
        await source.destroy()
        await admin.query(REVOKE_BACKEND_ROLE)
    })
    const app = source.manager
    const logger = loggerOf()
    const inbox = new InboxService()
    const publisher = new EventBusService(app)
    return {
        app,
        publisher,
        logger,
        count: async (table) => {
            const rows = await admin.query<Array<Readonly<Record<"n", string>>>>(COUNT_PGMQ_TABLE, [table])
            return Number(rows[0]?.n)
        },
        reset: (tables) =>
            admin.transaction(async (tx) => {
                await tx.query("SELECT set_config('proof.tables', $1, true)", [tables.join(",")])
                await tx.query(EMPTY_PGMQ_TABLES)
            }),
        runnerOf: (options = {}) => new EventConsumerService(app, options, logger),
        door: (effects, fail = () => false) => ({
            event: SpecEvent,
            handle: (delivery: EventDelivery<SpecEvent>) =>
                app.transaction(async (manager) => {
                    if (fail()) throw new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
                    if (await inbox.claim(delivery.consumer, delivery.dedupeKey, manager)) {
                        effects.push(`${delivery.consumer}:${delivery.dedupeKey}:${String(delivery.attempt)}`)
                    }
                }),
        }),
        publish: (name, key) =>
            app.transaction((manager) =>
                publisher.publish(
                    new SpecEvent(name, `${name}:${key}`, { dedupeKey: key, subjectId: "1" }),
                    manager,
                    "request-1",
                ),
            ),
        appIsRefusedPgmq: async () => {
            try {
                await app.query(READ_PGMQ_META)
                return false
            } catch (cause) {
                return String(cause).includes("permission denied")
            }
        },
    }
}

/** Runs the queues of a subscription for a number of rounds, one after the other. */
export const drainRounds = async (rounds: number, round: () => Promise<void>): Promise<void> => {
    await eachInOrder(
        Array.from({ length: rounds }, (_, index) => index),
        round,
    )
}
