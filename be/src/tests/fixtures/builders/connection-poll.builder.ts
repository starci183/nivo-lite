import { builder } from "@starci/jest-preset"
import { connectionPollEntities, type PollPage, type PollScheduleRow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"

const ConnectionPollScheduleEntity: (typeof connectionPollEntities)[0] = connectionPollEntities[0]
type ConnectionPollScheduleEntity = InstanceType<typeof ConnectionPollScheduleEntity>

/** The instant the poll specs treat as now. */
export const POLL_NOW: string = "2026-11-04T10:00:00.000Z"

/** The instant the poll specs treat as now, in milliseconds. */
export const POLL_NOW_MS: number = Date.parse(POLL_NOW)

/** The instant the entities of the poll specs are due at. */
export const POLL_DUE_AT: Date = new Date("2026-11-04T09:59:00.000Z")

/** One minute in milliseconds. */
export const POLL_MINUTE_MS: number = 60_000

/** A page of a poll that read something: two items, the oldest ten minutes and the newest one minute before now. */
export type ReadPollPage = Extract<PollPage<string>, { kind: "page" }>

/** The schedule row of connection c-1 of workspace ws-1 at Sepay: closed breaker, a 30 minute interval, a webhook one minute ago. */
export const pollScheduleRowOf: (overrides?: Partial<PollScheduleRow>) => PollScheduleRow = builder<PollScheduleRow>({
    connectionId: "c-1",
    workspaceId: "ws-1",
    provider: "sepay",
    intervalMs: 30 * POLL_MINUTE_MS,
    failures: 0,
    breakerState: "closed",
    breakerOpenedAt: null,
    needsReauth: false,
    hotUntil: null,
    lastSuccessAt: null,
    lastWebhookAt: new Date(POLL_NOW_MS - POLL_MINUTE_MS),
    unavailableReason: null,
    backfillTo: null,
    backfillNewest: null,
})

/** The entity of the schedule row of connection c-1, due one minute before now. */
export const pollScheduleEntityOf: (
    overrides?: Partial<ConnectionPollScheduleEntity>,
) => ConnectionPollScheduleEntity = (overrides = {}) =>
    Object.assign(new ConnectionPollScheduleEntity(), {
        ...pollScheduleRowOf(),
        nextPollAt: POLL_DUE_AT,
        hotReason: null,
        ...overrides,
    })

/** The entity of the schedule row of connection c-2 of workspace ws-2, due like c-1. */
export const secondPollScheduleEntityOf = (): ConnectionPollScheduleEntity =>
    pollScheduleEntityOf({ connectionId: "c-2", workspaceId: "ws-2" })

/** The instant the open breaker entity stays hot until. */
export const POLL_HOT_UNTIL: Date = new Date("2026-11-04T10:05:00.000Z")

/** The entity of a row with every column set: the breaker open after five failures, hot, plan-limited, read and hit by a webhook, mid-backfill. */
export const busyPollScheduleEntityOf = (): ConnectionPollScheduleEntity =>
    pollScheduleEntityOf({
        breakerState: "open",
        breakerOpenedAt: POLL_DUE_AT,
        failures: 5,
        needsReauth: false,
        hotUntil: POLL_HOT_UNTIL,
        unavailableReason: "plan",
        lastSuccessAt: POLL_DUE_AT,
        lastWebhookAt: POLL_DUE_AT,
        backfillTo: POLL_DUE_AT,
        backfillNewest: POLL_HOT_UNTIL,
    })

/** The connection c-1 of workspace ws-1 at Sepay: live, connected, read up to nine in the morning. */
export const pollConnectionRecordOf: (overrides?: Partial<ConnectionRecord>) => ConnectionRecord =
    builder<ConnectionRecord>({
        id: "c-1",
        workspaceId: "ws-1",
        provider: "sepay",
        name: "SePay",
        meta: { poll_seen_at: "2026-11-04T09:00:00.000Z" },
        status: "connected",
        lastError: null,
        environment: "live",
        isDefault: false,
        lastEventAt: null,
        firstEvent: null,
        createdBy: null,
        createdAt: "2026-11-03T00:00:00.000Z",
    })

/** A page of a poll that read something, with `fetched` rows. */
export const readPollPageOf = (fetched: number, overrides: Partial<ReadPollPage> = {}): ReadPollPage => ({
    kind: "page",
    items: ["a", "b"],
    fetched,
    oldestAt: new Date(POLL_NOW_MS - 10 * POLL_MINUTE_MS),
    newestAt: new Date(POLL_NOW_MS - POLL_MINUTE_MS),
    ...overrides,
})
