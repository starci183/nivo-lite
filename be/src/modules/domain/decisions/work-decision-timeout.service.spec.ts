import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import type { AfterCommit } from "@modules/platform/database"
import { AFTER_COMMIT } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { timeoutFixture } from "@tests/fixtures/builders/work-decision-timeout.builder"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
import { DecisionLogReadService } from "./decision-log-read.service"
import { WorkDecisionTimeoutService } from "./work-decision-timeout.service"
import { WorkItemClosedService } from "./work-item-closed.service"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"

const CONTEXT = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" } as const
const POLICY = { name: "NIVO", kind: "staff" } as const
const MEMBER_ID = "00000000-0000-4000-8000-000000000042"

const build = async () => {
    const afterCommit = mock<AfterCommit>()
    const fixture = timeoutFixture(afterCommit)
    const reads = mock<WorkItemsDecisionsReadService>()
    reads.claimDecision.mockResolvedValue({ kind: "open" })
    reads.lockForDecision.mockResolvedValue(fixture.item)
    const items = mock<WorkItemsService>()
    items.markRejected.mockResolvedValue(fixture.rejected)
    const decisions = mock<DecisionLogReadService>()
    decisions.decidersOf.mockResolvedValue(new Map())
    const recorder = mock<WorkRecorderService>()
    recorder.recordRejected.mockResolvedValue(undefined)
    recorder.rejected.mockResolvedValue(undefined)
    const closed = mock<WorkItemClosedService>()
    closed.tell.mockResolvedValue(undefined)
    const registry = mock<WorkPerformerRegistry>()
    registry.performerOf.mockReturnValue(fixture.performer)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Rejected by timeout")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkDecisionTimeoutService,
            { provide: WorkItemsDecisionsReadService, useValue: reads },
            { provide: WorkItemsService, useValue: items },
            { provide: DecisionLogReadService, useValue: decisions },
            { provide: WorkRecorderService, useValue: recorder },
            { provide: WorkItemClosedService, useValue: closed },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: AFTER_COMMIT, useValue: afterCommit },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkDecisionTimeoutService),
        ...fixture,
        reads,
        items,
        decisions,
        recorder,
        closed,
        registry,
        catalog,
        logger,
    }
}

const claimOpenCases = () => {
    it("defers a busy decision without reading or inventing a principal", async () => {
        const built = await build()
        built.reads.claimDecision.mockResolvedValue({ kind: "busy" })

        await expect(built.service.claim(built.manager, "ws-1", "item-1")).resolves.toEqual({ kind: "busy" })

        expect(built.reads.claimDecision).toHaveBeenCalledWith(built.manager, "ws-1", "item-1")
        expect(built.decisions.decidersOf).not.toHaveBeenCalled()
        expect(built.items.markRejected).not.toHaveBeenCalled()
    })

    it("returns an open locked decision without consulting the actor log", async () => {
        const built = await build()

        await expect(built.service.claim(built.manager, "ws-1", "item-1")).resolves.toEqual({ kind: "open" })

        expect(built.reads.claimDecision).toHaveBeenCalledWith(built.manager, "ws-1", "item-1")
        expect(built.decisions.decidersOf).not.toHaveBeenCalled()
        expect(built.pending).toEqual([])
    })
}
const claimReplayCases = () => {
    it.each(["done", "rejected"] as const)(
        "replays a %s item with its recorded member id through the caller's manager",
        async (status) => {
            const built = await build()
            const item = itemOf({ status })
            built.reads.claimDecision.mockResolvedValue({ kind: "closed", item })
            built.decisions.decidersOf.mockResolvedValue(new Map([[item.id, MEMBER_ID]]))

            await expect(built.service.claim(built.manager, "ws-1", item.id)).resolves.toEqual({
                kind: "closed",
                item,
                memberId: MEMBER_ID,
            })

            expect(built.decisions.decidersOf).toHaveBeenCalledWith([item.id], built.manager)
            expect(built.items.markRejected).not.toHaveBeenCalled()
        },
    )

    it.each(["missing", "null"] as const)(
        "retains an unknown principal when the decision log entry is %s",
        async (state) => {
            const built = await build()
            const item = itemOf({ status: "done" })
            built.reads.claimDecision.mockResolvedValue({ kind: "closed", item })
            built.decisions.decidersOf.mockResolvedValue(state === "missing" ? new Map() : new Map([[item.id, null]]))

            await expect(built.service.claim(built.manager, "ws-1", item.id)).resolves.toEqual({
                kind: "closed",
                item,
                memberId: null,
            })

            expect(built.pending).toEqual([])
        },
    )
}
const claimFailureCases = () => {
    it("propagates a failed lock classification without consulting the actor log", async () => {
        const built = await build()
        const cause = new Error("decision lock unavailable")
        built.reads.claimDecision.mockRejectedValue(cause)

        await expect(built.service.claim(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.decisions.decidersOf).not.toHaveBeenCalled()
        expect(built.pending).toEqual([])
    })

    it("keeps a failed principal lookup visible instead of returning a fabricated decision", async () => {
        const built = await build()
        built.reads.claimDecision.mockResolvedValue({ kind: "closed", item: itemOf({ status: "done" }) })
        const cause = new Error("decision log unavailable")
        built.decisions.decidersOf.mockRejectedValue(cause)

        await expect(built.service.claim(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.items.markRejected).not.toHaveBeenCalled()
        expect(built.pending).toEqual([])
    })
}
const rejectUnchangedCases = () => {
    it.each([null, "queued", "failed", "done", "rejected"] as const)(
        "leaves a %s owner unchanged and schedules no notification",
        async (status) => {
            const built = await build()
            built.reads.lockForDecision.mockResolvedValue(status === null ? null : itemOf({ status }))

            await expect(built.service.reject(built.manager, "ws-1", "item-1")).resolves.toBe(false)

            expect(built.reads.lockForDecision).toHaveBeenCalledWith(built.manager, "ws-1", "item-1")
            expect(built.items.markRejected).not.toHaveBeenCalled()
            expect(built.recorder.recordRejected).not.toHaveBeenCalled()
            expect(built.afterCommit.run).not.toHaveBeenCalled()
            expect(built.pending).toEqual([])
        },
    )

    it("propagates a failed owner lock before changing the decision", async () => {
        const built = await build()
        const cause = new Error("owner lock unavailable")
        built.reads.lockForDecision.mockRejectedValue(cause)

        await expect(built.service.reject(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.items.markRejected).not.toHaveBeenCalled()
        expect(built.pending).toEqual([])
    })

    it("propagates a failed status write without recording or scheduling a rejection", async () => {
        const built = await build()
        const cause = new Error("status write failed")
        built.items.markRejected.mockRejectedValue(cause)

        await expect(built.service.reject(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.recorder.recordRejected).not.toHaveBeenCalled()
        expect(built.pending).toEqual([])
    })

    it("propagates a failed durable decision record without delivering external effects", async () => {
        const built = await build()
        const cause = new Error("decision record failed")
        built.recorder.recordRejected.mockRejectedValue(cause)

        await expect(built.service.reject(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.pending).toEqual([])
        expect(built.registry.performerOf).not.toHaveBeenCalled()
        expect(built.closed.tell).not.toHaveBeenCalled()
    })
}
const rejectCommitCases = () => {
    it("records the policy rejection in the caller's manager before delivering anything after commit", async () => {
        const built = await build()

        await expect(built.service.reject(built.manager, "ws-1", "item-1")).resolves.toBe(true)

        expect(built.catalog.get).toHaveBeenCalledWith("engine.rejectedResult", {}, "vi")
        expect(built.items.markRejected).toHaveBeenCalledWith(
            "item-1",
            built.item.proposal,
            { summary: "Rejected by timeout" },
            built.manager,
        )
        expect(built.recorder.recordRejected).toHaveBeenCalledWith(
            built.manager,
            CONTEXT,
            built.item,
            built.item.proposal,
            POLICY,
            null,
        )
        expect(built.pending).toHaveLength(1)
        expect(built.afterCommit.run.mock.calls[0]?.[0]).toBe(built.manager)
        expect(built.registry.performerOf).not.toHaveBeenCalled()
        expect(built.rejection.onReject).not.toHaveBeenCalled()
        expect(built.recorder.rejected).not.toHaveBeenCalled()
        expect(built.closed.tell).not.toHaveBeenCalled()

        await built.deliver()

        expect(built.rejection.onReject).toHaveBeenCalledWith(CONTEXT, built.item, built.item.proposal, POLICY)
        expect(built.recorder.rejected).toHaveBeenCalledWith(
            CONTEXT,
            built.item,
            built.item.proposal,
            POLICY,
            null,
            true,
        )
        expect(built.closed.tell).toHaveBeenCalledWith(CONTEXT, built.rejected, POLICY)
        expect(built.pending).toEqual([])
        expect(built.items.markRejected).toHaveBeenCalledTimes(1)
        expect(built.logger.error).not.toHaveBeenCalled()
    })
}
const rejectNotificationCases = () => {
    it.each(["absent", "without hook"] as const)(
        "notifies the closed owner when the performer is %s",
        async (state) => {
            const built = await build()
            built.registry.performerOf.mockReturnValue(state === "absent" ? null : built.barePerformer)

            await expect(built.service.reject(built.manager, "ws-1", "item-1")).resolves.toBe(true)
            await built.deliver()

            expect(built.closed.tell).toHaveBeenCalledWith(CONTEXT, built.rejected, POLICY)
            expect(built.rejection.onReject).not.toHaveBeenCalled()
            expect(built.logger.error).not.toHaveBeenCalled()
        },
    )

    it.each(["performer", "recorder", "closed hook"] as const)(
        "reports a failed %s notification without writing the decision again",
        async (stage) => {
            const built = await build()
            const cause = new Error(`${stage} unavailable`)
            if (stage === "performer") built.rejection.onReject.mockRejectedValue(cause)
            if (stage === "recorder") built.recorder.rejected.mockRejectedValue(cause)
            if (stage === "closed hook") built.closed.tell.mockRejectedValue(cause)

            await expect(built.service.reject(built.manager, "ws-1", "item-1")).resolves.toBe(true)
            await expect(built.deliver()).resolves.toBeUndefined()

            expect(built.logger.error).toHaveBeenCalledWith(WorkEngineLogEvent.ClosedNotificationFailed, cause, {
                workItemId: "item-1",
            })
            expect(built.recorder.recordRejected).toHaveBeenCalledTimes(1)
            expect(built.items.markRejected).toHaveBeenCalledTimes(1)
            expect(built.pending).toEqual([])
        },
    )

    it("keeps a failed notification scheduling visible after recording the decision", async () => {
        const built = await build()
        const cause = new Error("notification scheduling unavailable")
        built.afterCommit.run.mockRejectedValue(cause)

        await expect(built.service.reject(built.manager, "ws-1", "item-1")).rejects.toBe(cause)

        expect(built.recorder.recordRejected).toHaveBeenCalledWith(
            built.manager,
            CONTEXT,
            built.item,
            built.item.proposal,
            POLICY,
            null,
        )
        expect(built.pending).toEqual([])
        expect(built.closed.tell).not.toHaveBeenCalled()
    })
}
describe("WorkDecisionTimeoutService", () => {
    describe("claim", () => {
        describe("lock classification", claimOpenCases)
        describe("recorded principals", claimReplayCases)
        describe("read failures", claimFailureCases)
    })
    describe("reject", () => {
        describe("unchanged owner and write failures", rejectUnchangedCases)
        describe("durable decision before notification", rejectCommitCases)
        describe("notification outcomes", rejectNotificationCases)
    })
})
