import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    POLL_DUE_AT,
    POLL_HOT_UNTIL,
    busyPollScheduleEntityOf,
    pollScheduleEntityOf,
    secondPollScheduleEntityOf,
} from "@tests/fixtures/builders/connection-poll.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { CONNECTION_POLL_OPTIONS } from "./connection-poll.decorators"
import { ConnectionPollScheduleEntity } from "./persistence/entities"
import { PollScheduleService } from "./poll-schedule.service"
import { DEFAULT_POLL_SCHEDULE } from "./poll-schedule.policy"
import type { PollPlan } from "./poll-schedule.policy"

const DUE = POLL_DUE_AT
const ENROLL = 'SELECT * FROM "public"."connection_poll_enroll"($1, $2)'
const MARK_HOT = 'SELECT * FROM "public"."connection_poll_mark_hot"($1, $2, $3, $4)'

const build = async (em = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            PollScheduleService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CONNECTION_POLL_OPTIONS, useValue: { schedule: DEFAULT_POLL_SCHEDULE, redis: undefined } },
        ],
    }).compile()
    return moduleRef.get(PollScheduleService)
}

const planOf = (over: Partial<PollPlan> = {}): PollPlan => ({
    nextPollAt: Date.parse("2026-11-04T10:30:00.000Z"),
    intervalMs: 1_800_000,
    failures: 0,
    breakerState: "closed",
    breakerOpenedAt: null,
    needsReauth: false,
    raiseOwnerNotice: false,
    succeeded: true,
    unavailableReason: null,
    backfillTo: null,
    backfillNewest: null,
    ...over,
})

describe("PollScheduleService enroll", () => {
    it("gives every connection of the providers a row, spread over the healthy interval", async () => {
        const em = mockEntityManager({ query: [ENROLL, []] })
        const service = await build(em)

        await service.enroll(["sepay", "zalo_oa"])

        expect(em.query).toHaveBeenCalledWith(ENROLL, [["sepay", "zalo_oa"], DEFAULT_POLL_SCHEDULE.healthyIntervalMs])
    })
})

describe("PollScheduleService claimDue", () => {
    it("claims the due connections under a skip-locked read, oldest first, and holds them for the lease", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 2 }] }))
        const [fake] = queueQueryBuilders(tx.em, [{ getMany: [pollScheduleEntityOf(), secondPollScheduleEntityOf()] }])
        const service = await build(tx.em)

        const claimed = await service.claimDue(["sepay"], 20)

        expect(claimed.map((item) => [item.row.connectionId, item.row.workspaceId, item.dueAt])).toEqual([
            ["c-1", "ws-1", DUE],
            ["c-2", "ws-2", DUE],
        ])
        expect(fake?.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(fake?.callsOf("setOnLocked")).toEqual([["skip_locked"]])
        expect(fake?.callsOf("limit")).toEqual([[20]])
        expect(fake?.callsOf("orderBy")).toEqual([["s.next_poll_at"]])
        expect(fake?.callsOf("where")[0]?.[1]).toEqual({ providers: ["sepay"] })
        const [, criteria, set] = tx.em.update.mock.calls[0] ?? []
        expect(criteria).toEqual({ connectionId: In(["c-1", "c-2"]) })
        expect(evaluatedValues(set)).toEqual({ nextPollAt: "now() + make_interval(secs => 600)" })
        expect(tx.commits).toBe(1)
    })

    it("writes nothing when nothing is due", async () => {
        const tx = fakeTransaction(mockEntityManager())
        queueQueryBuilders(tx.em, [{ getMany: [] }])
        const service = await build(tx.em)

        await expect(service.claimDue(["sepay"], 20)).resolves.toEqual([])
        expect(tx.em.update).not.toHaveBeenCalled()
    })

    it("reads every column of the row for the planner", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 1 }] }))
        const hot = POLL_HOT_UNTIL
        queueQueryBuilders(tx.em, [
            {
                getMany: [busyPollScheduleEntityOf()],
            },
        ])
        const service = await build(tx.em)

        const [item] = await service.claimDue(["sepay"], 1)

        expect(item?.row).toEqual({
            connectionId: "c-1",
            workspaceId: "ws-1",
            provider: "sepay",
            intervalMs: 1_800_000,
            failures: 5,
            breakerState: "open",
            breakerOpenedAt: DUE,
            needsReauth: false,
            hotUntil: hot,
            unavailableReason: "plan",
            lastSuccessAt: DUE,
            lastWebhookAt: DUE,
            backfillTo: DUE,
            backfillNewest: hot,
        })
    })
})

describe("PollScheduleService settle and defer", () => {
    it("writes the plan and stamps the success time of a poll that ended well", async () => {
        const em = mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 1 }] })
        const service = await build(em)

        await service.settle(
            "c-1",
            planOf({ backfillTo: DUE.getTime(), backfillNewest: DUE.getTime(), breakerOpenedAt: DUE.getTime() }),
        )

        const [, criteria, set] = em.update.mock.calls[0] ?? []
        expect(criteria).toEqual({ connectionId: "c-1" })
        expect(evaluatedValues(set)).toEqual({
            nextPollAt: new Date("2026-11-04T10:30:00.000Z"),
            intervalMs: 1_800_000,
            failures: 0,
            breakerState: "closed",
            breakerOpenedAt: DUE,
            needsReauth: false,
            unavailableReason: null,
            backfillTo: DUE,
            backfillNewest: DUE,
            lastSuccessAt: "now()",
        })
    })

    it("leaves the success time alone for a poll that failed and clears what the plan clears", async () => {
        const em = mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 1 }] })
        const service = await build(em)

        await service.settle("c-1", planOf({ succeeded: false, failures: 2 }))

        const set = evaluatedValues(em.update.mock.calls[0]?.[2])
        expect(Reflect.has(set, "lastSuccessAt")).toBe(false)
        expect(set).toMatchObject({ failures: 2, breakerOpenedAt: null, backfillTo: null, backfillNewest: null })
    })

    it("plans the connection again without counting a poll", async () => {
        const em = mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 1 }] })
        const service = await build(em)

        await service.defer("c-1", DUE)

        expect(em.update).toHaveBeenCalledWith(
            ConnectionPollScheduleEntity,
            { connectionId: "c-1" },
            { nextPollAt: DUE },
        )
    })
})

describe("PollScheduleService signals", () => {
    it("makes a connection hot for the given time and brings its next poll forward", async () => {
        const em = mockEntityManager({ query: [MARK_HOT, []] })
        const service = await build(em)

        await service.markHot("c-1", "order_awaiting_payment", 120_000)

        expect(em.query).toHaveBeenCalledWith(MARK_HOT, [
            "c-1",
            DEFAULT_POLL_SCHEDULE.hotIntervalMs,
            120_000,
            "order_awaiting_payment",
        ])
    })

    it("stays hot for the configured time when the caller names none", async () => {
        const em = mockEntityManager({ query: [MARK_HOT, []] })
        const service = await build(em)

        await service.markHot("c-1", "payment_claim_open")

        expect(em.query.mock.calls[0]?.[1]).toEqual([
            "c-1",
            DEFAULT_POLL_SCHEDULE.hotIntervalMs,
            DEFAULT_POLL_SCHEDULE.hotTtlMs,
            "payment_claim_open",
        ])
    })

    it("clears the breaker and the owner request of a connection that became ready, then makes it hot", async () => {
        const em = mockEntityManager({
            update: [ConnectionPollScheduleEntity, { affected: 1 }],
            query: [MARK_HOT, []],
        })
        const service = await build(em)

        await service.markReady("c-1")

        expect(em.update).toHaveBeenCalledWith(
            ConnectionPollScheduleEntity,
            { connectionId: "c-1" },
            { failures: 0, breakerState: "closed", breakerOpenedAt: null, needsReauth: false, unavailableReason: null },
        )
        expect(em.query.mock.calls[0]?.[1]).toEqual([
            "c-1",
            DEFAULT_POLL_SCHEDULE.hotIntervalMs,
            DEFAULT_POLL_SCHEDULE.hotTtlMs,
            "connection_ready",
        ])
    })

    it("stamps the delivery of the webhook", async () => {
        const em = mockEntityManager({ update: [ConnectionPollScheduleEntity, { affected: 1 }] })
        const service = await build(em)

        await service.recordWebhook("c-1")

        const set = evaluatedValues(em.update.mock.calls[0]?.[2])
        expect(set).toEqual({ lastWebhookAt: "now()" })
    })
})
