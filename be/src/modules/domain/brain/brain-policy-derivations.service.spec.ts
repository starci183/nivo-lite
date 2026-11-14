import { FakeClock, fakeTransaction, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { TeamChatNoticesService } from "@modules/domain/team-chat"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainPolicyDerivationEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-11-11T10:00:00.000Z"
const NOW_MS = Date.parse(NOW)

/** A stored state row. */
const rowOf = entityRowBuilder<BrainPolicyDerivationEntity>({
    workspaceId: WS,
    status: "idle",
    requestedAt: new Date(NOW_MS - 60_000),
    startedAt: null,
    derivedAt: null,
    attempts: 0,
    error: null,
    createdAt: new Date(NOW_MS - 3_600_000),
    updatedAt: new Date(NOW_MS - 60_000),
})

/** The workspaces one backfill read answers; the double hands out one query builder per read, so a spec may read several times. */
const READS = 4

const build = async (row: BrainPolicyDerivationEntity | null = null, workspaces: ReadonlyArray<string> = []) => {
    const em = mockEntityManager({
        findOne: [BrainPolicyDerivationEntity, row],
        upsert: [BrainPolicyDerivationEntity, { raw: [] }],
        update: [BrainPolicyDerivationEntity, { affected: 1 }],
    })
    // The transaction hands a scoped view of the same manager: the spec reads what was written in it.
    const transaction = fakeTransaction(em)
    const reads = Array.from({ length: READS }, () => ({ getRawMany: workspaces.map((id) => ({ workspace_id: id })) }))
    const chains = queueQueryBuilders(em, reads)
    const queue = mock<KnowledgeQueue>()
    const facts = mock<BrainFactsService>()
    const members = mock<WorkspaceMembersService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPolicyDerivationsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: BrainFactsService, useValue: facts },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(BrainPolicyDerivationsService), em, queue, facts, members, logger, chains, transaction }
}

/** The `limit` of every backfill read, in call order. */
const limitsOf = (chains: ReadonlyArray<{ callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>> }>): ReadonlyArray<ReadonlyArray<unknown>> =>
    chains.flatMap((chain) => chain.callsOf("limit"))

describe("BrainPolicyDerivationsService: request", () => {
    it("a workspace with no state gets one: queued, with its job written in the same transaction", async () => {
        const { service, em, queue, transaction } = await build(null)

        await expect(service.request(WS)).resolves.toBe("queued")

        expect(em.upsert).toHaveBeenCalledWith(
            BrainPolicyDerivationEntity,
            { workspaceId: WS, status: "queued", requestedAt: new Date(NOW), attempts: 0, error: null },
            ["workspaceId"],
        )
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledWith({ workspaceId: WS }, expect.anything(), NOW_MS)
        expect(transaction.commits).toBe(1)
    })

    it.each(["idle", "failed"] as const)("a workspace whose last pass is %s is queued again", async (status) => {
        const { service, queue } = await build(rowOf({ status }))

        await expect(service.request(WS)).resolves.toBe("queued")
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
    })

    it("a pass that already waits only learns the time of the change: a burst of changes is one job", async () => {
        const { service, em, queue } = await build(rowOf({ status: "queued" }))

        await expect(service.request(WS)).resolves.toBe("pending")

        expect(queue.enqueuePolicyDerive).not.toHaveBeenCalled()
        expect(em.update).toHaveBeenCalledWith(
            BrainPolicyDerivationEntity,
            { workspaceId: WS },
            { requestedAt: new Date(NOW) },
        )
    })

    it("a pass that runs only learns the time of the change (it runs once more when it ends)", async () => {
        const { service, queue } = await build(rowOf({ status: "running", startedAt: new Date(NOW_MS - 5_000) }))

        await expect(service.request(WS)).resolves.toBe("pending")
        expect(queue.enqueuePolicyDerive).not.toHaveBeenCalled()
    })

    it("a pass that waited or ran for more than fifteen minutes is taken for lost and queued again", async () => {
        const lost = await build(rowOf({ status: "queued", requestedAt: new Date(NOW_MS - 16 * 60_000) }))
        await expect(lost.service.request(WS)).resolves.toBe("queued")
        expect(lost.queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)

        const stuck = await build(
            rowOf({
                status: "running",
                startedAt: new Date(NOW_MS - 16 * 60_000),
                requestedAt: new Date(NOW_MS - 1_000),
            }),
        )
        await expect(stuck.service.request(WS)).resolves.toBe("queued")
    })
})

describe("BrainPolicyDerivationsService: the fact-change hook", () => {
    it("registers itself with the facts store when the module starts", async () => {
        const { service, facts } = await build()

        service.onModuleInit()

        expect(facts.whenChanged).toHaveBeenCalledWith(service)
    })

    it("asks for a pass when what is in force changed", async () => {
        const { service, queue } = await build(null)

        await service.factsChanged(WS)

        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
    })

    it("D-BR-2 (e): a pass given up on its model is not asked again by every change while it is recent; later it is", async () => {
        const recent = await build(rowOf({ status: "failed", error: "model", updatedAt: new Date(NOW_MS - 60_000) }))
        await recent.service.factsChanged(WS)
        expect(recent.queue.enqueuePolicyDerive).not.toHaveBeenCalled()

        const old = await build(rowOf({ status: "failed", error: "model", updatedAt: new Date(NOW_MS - 31 * 60_000) }))
        await old.service.factsChanged(WS)
        expect(old.queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)

        // A pass that stopped for credits is asked again by a change (credits may be back; the pass checks the pool first).
        const credits = await build(rowOf({ status: "failed", error: "credits", updatedAt: new Date(NOW_MS - 60_000) }))
        await credits.service.factsChanged(WS)
        expect(credits.queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
    })

    it("never throws into the fact write: a failure is logged with the workspace", async () => {
        const { service, em, logger } = await build(null)
        const cause = new Error("database is down")
        em.transaction.mockRejectedValue(cause)

        await expect(service.factsChanged(WS)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith("brain.policies.request_failed", cause, { workspaceId: WS })
    })
})

describe("BrainPolicyDerivationsService: the pass, its start and its end", () => {
    it("started: the state is running from now and answers the failed tries so far", async () => {
        const { service, em } = await build(rowOf({ status: "running", attempts: 2 }))

        await expect(service.started(WS)).resolves.toEqual({ startedAt: new Date(NOW), attempts: 2 })
        expect(em.upsert).toHaveBeenCalledWith(
            BrainPolicyDerivationEntity,
            { workspaceId: WS, status: "running", startedAt: new Date(NOW) },
            ["workspaceId"],
        )
    })

    it("finished: idle, with the tries and the error cleared", async () => {
        const startedAt = new Date(NOW_MS - 2_000)
        const { service, em, queue } = await build(
            rowOf({ status: "running", requestedAt: new Date(NOW_MS - 5_000), startedAt }),
        )

        await expect(service.finished(WS, startedAt)).resolves.toBe("idle")

        expect(em.update).toHaveBeenCalledWith(
            BrainPolicyDerivationEntity,
            { workspaceId: WS },
            { status: "idle", derivedAt: new Date(NOW), attempts: 0, error: null },
        )
        expect(queue.enqueuePolicyDerive).not.toHaveBeenCalled()
    })

    it("finished after a change came during the pass: one more pass is queued, keeping the time of that change", async () => {
        const startedAt = new Date(NOW_MS - 2_000)
        const requestedAt = new Date(NOW_MS - 1_000)
        const { service, em, queue, transaction } = await build(rowOf({ status: "running", requestedAt, startedAt }))

        await expect(service.finished(WS, startedAt)).resolves.toBe("queued")

        expect(em.upsert).toHaveBeenCalledWith(
            BrainPolicyDerivationEntity,
            { workspaceId: WS, status: "queued", requestedAt, attempts: 0, error: null },
            ["workspaceId"],
        )
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledWith({ workspaceId: WS }, expect.anything(), NOW_MS)
        expect(transaction.commits).toBe(1)
    })

    it("more: the next pass is queued", async () => {
        const { service, queue } = await build(rowOf({ status: "running" }))

        await service.more(WS)

        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
    })
})

describe("BrainPolicyDerivationsService: the pass, its tries and its state", () => {
    it("retrying and failed are recorded on the state", async () => {
        const { service, em } = await build(rowOf({ status: "running" }))

        await service.retrying(WS, 2)
        await service.failed(WS, "model", 3)
        await service.failed(WS, "credits")

        expect(em.update).toHaveBeenNthCalledWith(
            1,
            BrainPolicyDerivationEntity,
            { workspaceId: WS },
            { attempts: 2, error: "model" },
        )
        expect(em.update).toHaveBeenNthCalledWith(
            2,
            BrainPolicyDerivationEntity,
            { workspaceId: WS },
            { status: "failed", error: "model", attempts: 3 },
        )
        expect(em.update).toHaveBeenNthCalledWith(
            3,
            BrainPolicyDerivationEntity,
            { workspaceId: WS },
            { status: "failed", error: "credits" },
        )
    })

    it("state: the row as ISO text, or null when no pass was ever asked for", async () => {
        const derivedAt = new Date(NOW_MS - 30_000)
        const known = await build(rowOf({ status: "idle", derivedAt }))
        await expect(known.service.state(WS)).resolves.toEqual({
            status: "idle",
            requestedAt: new Date(NOW_MS - 60_000).toISOString(),
            startedAt: null,
            derivedAt: derivedAt.toISOString(),
            attempts: 0,
            error: null,
        })
        expect(known.em.findOne).toHaveBeenCalledTimes(1)

        await expect((await build(null)).service.state(WS)).resolves.toBeNull()
    })
})

describe("BrainPolicyDerivationsService: the doors", () => {
    it("backfill asks for a pass in each workspace that has facts in force and no state, in one read", async () => {
        const { service, queue, chains, em, logger } = await build(null, ["ws-a", "ws-b", "ws-c"])

        await expect(service.backfill()).resolves.toBe(3)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(chains[0]?.callsOf("where")).toEqual([["f.status = 'active'"]])
        expect(String(chains[0]?.callsOf("andWhere")[0]?.[0])).toContain("NOT EXISTS")
        expect(limitsOf(chains)).toEqual([[200]])
        expect(queue.enqueuePolicyDerive.mock.calls.map(([payload]) => payload.workspaceId)).toEqual([
            "ws-a",
            "ws-b",
            "ws-c",
        ])
        expect(logger.info).toHaveBeenCalledWith("brain.policies.backfilled", { workspaces: 3 })
    })

    it("backfill is bounded by its limit and goes on past a workspace whose request fails", async () => {
        const { service, queue, chains, logger } = await build(null, ["ws-a", "ws-b"])
        queue.enqueuePolicyDerive.mockRejectedValueOnce(new Error("outbox")).mockResolvedValue(undefined)

        await expect(service.backfill(5)).resolves.toBe(2)

        expect(limitsOf(chains)).toEqual([[5]])
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("backfill reads a limit that is not a whole number (a bad cli flag) as the maximum, and one past it as the maximum", async () => {
        const { service, chains } = await build(null, [])

        await service.backfill(Number.NaN)
        await service.backfill(5000)

        expect(limitsOf(chains)).toEqual([[200], [200]])
    })

    it("the cli's backfill reads the flag as typed (absent = the maximum) and prints how many passes were queued", async () => {
        const { service, chains } = await build(null, ["ws-a", "ws-b"])
        const out = { write: jest.fn() }

        await expect(service.backfillFor(out, "7")).resolves.toBe(2)
        await service.backfillFor(out)

        expect(limitsOf(chains)).toEqual([[7], [200]])
        expect(out.write.mock.calls).toEqual([
            ["queued 2 workspace policy derive pass(es)\n"],
            ["queued 2 workspace policy derive pass(es)\n"],
        ])
    })

    it("the tab's door proves the caller is an owner or a manager, then asks", async () => {
        const { service, members, queue } = await build(null)

        await expect(service.requestFor("u1", WS)).resolves.toBe("queued")

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(queue.enqueuePolicyDerive).toHaveBeenCalledTimes(1)
    })

    it("the tab's door refuses a member the role check refuses, and queues nothing", async () => {
        const { service, members, queue } = await build(null)
        members.require.mockRejectedValue(new Error("WORKSPACE_MEMBERS_ROLE_FORBIDDEN"))

        await expect(service.requestFor("u2", WS)).rejects.toThrow("WORKSPACE_MEMBERS_ROLE_FORBIDDEN")
        expect(queue.enqueuePolicyDerive).not.toHaveBeenCalled()
    })
})


/** The service as a composition builds it: with NIVO's notices (the api) or without them (mcp, cli). */
const composed = async (row: BrainPolicyDerivationEntity | null, withNotices: boolean) => {
    // Strict double: the composition without notices stubs no read, so a read there would throw.
    const em = withNotices
        ? mockEntityManager({
              update: [BrainPolicyDerivationEntity, { affected: 1 }],
              findOne: [BrainPolicyDerivationEntity, row],
          })
        : mockEntityManager({ update: [BrainPolicyDerivationEntity, { affected: 1 }] })
    const notices = mock<TeamChatNoticesService>()
    notices.postBackgroundStopped.mockResolvedValue("posted")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPolicyDerivationsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: KnowledgeQueue, useValue: mock<KnowledgeQueue>() },
            { provide: BrainFactsService, useValue: mock<BrainFactsService>() },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            ...(withNotices ? [{ provide: TeamChatNoticesService, useValue: notices }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(BrainPolicyDerivationsService), em, notices, logger }
}

describe("BrainPolicyDerivationsService > failed: NIVO tells the founder once per failure episode", () => {
    /** The last pass that ended well: the failure episode (D-BR-2 (e)). */
    const EPISODE = new Date(NOW_MS - 3_600_000)

    it.each(["model", "credits", "gave_up"] as const)(
        "a pass given up (%s) writes the failed state, then posts NIVO's card keyed by the last pass that ended well",
        async (reason) => {
            const { service, em, notices } = await composed(
                rowOf({ status: "failed", requestedAt: new Date(NOW_MS - 60_000), derivedAt: EPISODE }),
                true,
            )

            await service.failed(WS, reason)

            expect(em.update).toHaveBeenCalledWith(
                BrainPolicyDerivationEntity,
                { workspaceId: WS },
                { status: "failed", error: reason },
            )
            expect(notices.postBackgroundStopped).toHaveBeenCalledTimes(1)
            expect(notices.postBackgroundStopped).toHaveBeenCalledWith(WS, {
                work: "brain.policies.derive",
                reason,
                episode: EPISODE,
            })
        },
    )

    it("the third try and the queue's later give-up of the SAME pass name the same episode (the card dedupes on it)", async () => {
        const { service, notices } = await composed(rowOf({ status: "failed", derivedAt: EPISODE }), true)

        await service.failed(WS, "model", 3)
        await service.failed(WS, "gave_up")

        const episodes = notices.postBackgroundStopped.mock.calls.map(([, report]) => report.episode.getTime())
        expect(episodes).toEqual([EPISODE.getTime(), EPISODE.getTime()])
    })

    it("D-BR-2 (e): a new request or fact change while the cause stands is the SAME episode (one card); a success starts a new one", async () => {
        const still = await composed(rowOf({ status: "failed", requestedAt: new Date(NOW_MS), derivedAt: EPISODE }), true)
        await still.service.failed(WS, "model", 3)
        expect(still.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, expect.objectContaining({ episode: EPISODE }))

        const neverDerived = await composed(rowOf({ status: "failed", requestedAt: new Date(NOW_MS), derivedAt: null }), true)
        await neverDerived.service.failed(WS, "model", 3)
        expect(neverDerived.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, expect.objectContaining({ episode: new Date(0) }))

        const afterSuccess = new Date(NOW_MS - 5_000)
        const fresh = await composed(rowOf({ status: "failed", derivedAt: afterSuccess }), true)
        await fresh.service.failed(WS, "model", 3)
        expect(fresh.notices.postBackgroundStopped).toHaveBeenCalledWith(WS, expect.objectContaining({ episode: afterSuccess }))
    })

    it("without the team chat (mcp, cli) the state is written and nothing is posted or read", async () => {
        const { service, em, notices } = await composed(rowOf({ status: "failed" }), false)

        await service.failed(WS, "credits")

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.findOne).not.toHaveBeenCalled()
        expect(notices.postBackgroundStopped).not.toHaveBeenCalled()
    })

    it("a report that fails is logged and never fails the state write", async () => {
        const { service, notices, logger } = await composed(rowOf({ status: "failed" }), true)
        notices.postBackgroundStopped.mockRejectedValue(new Error("db down"))

        await expect(service.failed(WS, "model", 3)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith("brain.policies.stop_report_failed", expect.any(Error), { workspaceId: WS })
    })

    it("no state row: nothing to report", async () => {
        const { service, notices } = await composed(null, true)

        await service.failed(WS, "gave_up")

        expect(notices.postBackgroundStopped).not.toHaveBeenCalled()
    })
})
